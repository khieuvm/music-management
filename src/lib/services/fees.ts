import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, assertRole, isManager, type Actor } from "@/lib/access";
import { allocatePayments, splitInstallments } from "@/lib/fees";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { localDateKey, localDateTime, startOfLocalDay } from "@/lib/time";
import { dateString, positiveInt, text, uuid, vnd } from "@/lib/validation";

export async function getEnrollmentFinance(db: PrismaClient, enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      installments: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { paidAt: "desc" }, include: { receivedBy: { select: { displayName: true } }, voidedBy: { select: { displayName: true } } } },
      classGroup: { select: { id: true, code: true, name: true } },
      student: { select: { id: true, code: true, fullName: true } },
    },
  });
  if (!enrollment) return null;
  const paidVnd = enrollment.payments.filter((payment) => !payment.voidedAt).reduce((sum, payment) => sum + payment.amountVnd, 0);
  return {
    enrollment,
    paidVnd,
    outstandingVnd: enrollment.tuitionVnd - paidVnd,
    installments: allocatePayments(enrollment.installments, paidVnd, startOfLocalDay()),
  };
}

/** Students only see their own enrollments; staff and admins see all. */
export async function getEnrollmentFinanceFor(db: PrismaClient, actor: Actor, enrollmentId: string) {
  const finance = await getEnrollmentFinance(db, enrollmentId);
  if (!finance) throw new RequestError(404, "Không tìm thấy ghi danh.");
  if (!isManager(actor) && finance.enrollment.studentId !== actor.studentId) throw new RequestError(404, "Không tìm thấy ghi danh.");
  return finance;
}

export const paymentSchema = z.object({
  amountVnd: vnd("Số tiền").refine((value) => value > 0, "Số tiền phải lớn hơn 0."),
  method: z.enum(["CASH", "TRANSFER"], "Chọn hình thức thanh toán."),
  paidDate: dateString("Ngày thu"),
  note: text(500, "Ghi chú"),
  idempotencyKey: uuid("Mã giao dịch"),
});

export async function recordPayment(db: PrismaClient, actor: Actor, enrollmentId: string, raw: unknown) {
  assertManager(actor);
  const input = paymentSchema.parse(raw);
  const today = localDateKey(new Date());
  if (input.paidDate > today) throw new RequestError(422, "Ngày thu không được ở tương lai.");
  const paidAt = input.paidDate === today ? new Date() : localDateTime(input.paidDate, "12:00");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${enrollmentId}::uuid FOR UPDATE`;
    const duplicate = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (duplicate.enrollmentId !== enrollmentId || duplicate.amountVnd !== input.amountVnd) {
        throw new RequestError(409, "Mã giao dịch đã được dùng cho khoản khác. Vui lòng tải lại trang.");
      }
      return { payment: duplicate, duplicate: true };
    }
    const enrollment = await tx.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new RequestError(404, "Không tìm thấy ghi danh.");
    const paid = await tx.payment.aggregate({ where: { enrollmentId, voidedAt: null }, _sum: { amountVnd: true } });
    const outstanding = enrollment.tuitionVnd - (paid._sum.amountVnd ?? 0);
    if (input.amountVnd > outstanding) {
      throw new RequestError(422, `Số tiền vượt quá số còn phải thu (${outstanding.toLocaleString("vi-VN")} đ).`);
    }
    const payment = await tx.payment.create({
      data: {
        enrollmentId, amountVnd: input.amountVnd, method: input.method, paidAt, note: input.note,
        idempotencyKey: input.idempotencyKey, receivedById: actor.userId,
      },
    });
    await audit(tx, actor, "payment.recorded", "Payment", payment.id, { enrollmentId, amountVnd: input.amountVnd, receiptNo: payment.receiptNo });
    return { payment, duplicate: false };
  });
}

export async function voidPayment(db: PrismaClient, actor: Actor, paymentId: string, reason: string) {
  assertRole(actor, "ADMIN");
  const cleanReason = text(500, "Lý do").parse(reason);
  if (!cleanReason) throw new RequestError(422, "Vui lòng nhập lý do hủy phiếu thu.");
  await db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: actor.userId, voidReason: cleanReason },
    });
    if (updated.count !== 1) throw new RequestError(409, "Phiếu thu không tồn tại hoặc đã bị hủy.");
    await audit(tx, actor, "payment.voided", "Payment", paymentId, { reason: cleanReason });
  });
}

export const installmentPlanSchema = z.object({
  tuitionVnd: vnd("Học phí cả khóa"),
  installmentCount: positiveInt("Số đợt", 12),
  firstDueDate: dateString("Hạn đợt đầu"),
  reason: text(300, "Lý do"),
});

/** Changes the course fee and/or rebuilds the installment schedule; past payments are untouched. */
export async function replanInstallments(db: PrismaClient, actor: Actor, enrollmentId: string, raw: unknown) {
  assertManager(actor);
  const input = installmentPlanSchema.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${enrollmentId}::uuid FOR UPDATE`;
    const enrollment = await tx.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new RequestError(404, "Không tìm thấy ghi danh.");
    const paid = (await tx.payment.aggregate({ where: { enrollmentId, voidedAt: null }, _sum: { amountVnd: true } }))._sum.amountVnd ?? 0;
    if (input.tuitionVnd < paid) throw new RequestError(422, "Học phí mới không được thấp hơn số tiền đã thu.");
    if (input.tuitionVnd !== enrollment.tuitionVnd && !input.reason) {
      throw new RequestError(422, "Vui lòng nhập lý do thay đổi học phí.");
    }
    await tx.feeInstallment.deleteMany({ where: { enrollmentId } });
    await tx.feeInstallment.createMany({
      data: splitInstallments(input.tuitionVnd, input.installmentCount, input.firstDueDate).map((item) => ({ ...item, enrollmentId })),
    });
    await tx.enrollment.update({ where: { id: enrollmentId }, data: { tuitionVnd: input.tuitionVnd } });
    await audit(tx, actor, "fee.replanned", "Enrollment", enrollmentId, {
      fromTuition: enrollment.tuitionVnd, toTuition: input.tuitionVnd, installments: input.installmentCount, reason: input.reason,
    });
  });
}

export async function listOutstanding(db: PrismaClient) {
  const enrollments = await db.enrollment.findMany({
    where: { tuitionVnd: { gt: 0 } },
    include: {
      installments: true,
      payments: { where: { voidedAt: null }, select: { amountVnd: true } },
      student: { select: { id: true, code: true, fullName: true, parentPhone: true } },
      classGroup: { select: { code: true, name: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
  const today = startOfLocalDay();
  return enrollments.map((enrollment) => {
    const paidVnd = enrollment.payments.reduce((sum, payment) => sum + payment.amountVnd, 0);
    const allocated = allocatePayments(enrollment.installments, paidVnd, today);
    return {
      enrollment,
      paidVnd,
      outstandingVnd: enrollment.tuitionVnd - paidVnd,
      overdueVnd: allocated.filter((item) => item.state === "OVERDUE").reduce((sum, item) => sum + item.outstandingVnd, 0),
      nextDue: allocated.find((item) => item.outstandingVnd > 0)?.dueDate ?? null,
    };
  }).filter((row) => row.outstandingVnd > 0);
}
