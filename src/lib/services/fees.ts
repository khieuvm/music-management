import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, assertRole, isManager, type Actor } from "@/lib/access";
import { toCsv } from "@/lib/csv";
import { allocatePayments, installmentStateText, splitInstallments, worstState, type InstallmentState } from "@/lib/fees";
import { formatVnd } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { addDays, dateOnlyKey, formatDate, localDateKey, localDateTime, todayDateOnly } from "@/lib/time";
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
    installments: allocatePayments(enrollment.installments, paidVnd, todayDateOnly()),
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

export type LedgerFilter = { classId?: string; studentIds?: string[]; includeInactive?: boolean };

/**
 * Fee position of every enrollment with tuition: installments with due-state colours, totals and the worst
 * unpaid state. Withdrawn enrollments are kept only while they still owe money.
 */
export async function feeLedger(db: PrismaClient, filter: LedgerFilter = {}) {
  const enrollments = await db.enrollment.findMany({
    where: {
      tuitionVnd: { gt: 0 },
      ...(filter.classId ? { classId: filter.classId } : {}),
      ...(filter.studentIds ? { studentId: { in: filter.studentIds } } : {}),
    },
    include: {
      installments: true,
      payments: { where: { voidedAt: null }, select: { amountVnd: true } },
      student: { select: { id: true, code: true, fullName: true, parentName: true, parentPhone: true, userId: true, status: true } },
      classGroup: { select: { id: true, code: true, name: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
  const today = todayDateOnly();
  return enrollments.map((enrollment) => {
    const paidVnd = enrollment.payments.reduce((sum, payment) => sum + payment.amountVnd, 0);
    const installments = allocatePayments(enrollment.installments, paidVnd, today);
    const unpaid = installments.filter((item) => item.outstandingVnd > 0);
    const sumState = (state: InstallmentState) => unpaid.filter((item) => item.state === state).reduce((sum, item) => sum + item.outstandingVnd, 0);
    return {
      enrollment,
      installments,
      paidVnd,
      outstandingVnd: Math.max(enrollment.tuitionVnd - paidVnd, 0),
      overdueVnd: sumState("OVERDUE"),
      dueTodayVnd: sumState("DUE_TODAY"),
      dueSoonVnd: sumState("DUE_SOON"),
      worst: worstState(installments),
      nextDue: unpaid.at(0) ?? null,
    };
  }).filter((row) => filter.includeInactive || row.enrollment.status !== "WITHDRAWN" || row.outstandingVnd > 0);
}

export type LedgerRow = Awaited<ReturnType<typeof feeLedger>>[number];

/** Unpaid installments, most urgent first, each with student/parent contact for collection. */
export async function listDueInstallments(db: PrismaClient, filter: LedgerFilter = {}) {
  const ledger = await feeLedger(db, filter);
  return ledger.flatMap((row) => row.installments.filter((item) => item.outstandingVnd > 0).map((item) => ({ row, item })))
    .sort((a, b) => a.item.dueDate.getTime() - b.item.dueDate.getTime() || a.row.enrollment.student.fullName.localeCompare(b.row.enrollment.student.fullName, "vi"));
}

export function summarizeDue(rows: { row: LedgerRow; item: { state: InstallmentState; outstandingVnd: number } }[]) {
  const empty = () => ({ amountVnd: 0, students: new Set<string>(), count: 0 });
  const groups = { OVERDUE: empty(), DUE_TODAY: empty(), DUE_SOON: empty(), UPCOMING: empty() };
  for (const { row, item } of rows) {
    if (item.state === "PAID") continue;
    const group = groups[item.state];
    group.amountVnd += item.outstandingVnd;
    group.count += 1;
    group.students.add(row.enrollment.studentId);
  }
  return Object.fromEntries(Object.entries(groups).map(([state, group]) => [state, { amountVnd: group.amountVnd, count: group.count, students: group.students.size }])) as
    Record<keyof typeof groups, { amountVnd: number; count: number; students: number }>;
}

export const dueViews = {
  "can-thu": { label: "Cần thu (quá hạn + 7 ngày tới)", states: ["OVERDUE", "DUE_TODAY", "DUE_SOON"] },
  "qua-han": { label: "Quá hạn", states: ["OVERDUE"] },
  "hom-nay": { label: "Đến hạn hôm nay", states: ["DUE_TODAY"] },
  "sap-den": { label: "Sắp đến hạn", states: ["DUE_SOON"] },
  "tat-ca": { label: "Tất cả khoản còn nợ", states: ["OVERDUE", "DUE_TODAY", "DUE_SOON", "UPCOMING"] },
} as const satisfies Record<string, { label: string; states: InstallmentState[] }>;
export type DueView = keyof typeof dueViews;

export function parseDueView(value: string): DueView {
  return value in dueViews ? value as DueView : "can-thu";
}

/** Shared by the outstanding page and its CSV export so both always show the same rows. */
export async function dueReport(db: PrismaClient, options: { view: DueView; classId?: string; q?: string }) {
  const classId = options.classId && /^[0-9a-f-]{36}$/i.test(options.classId) ? options.classId : undefined;
  const all = await listDueInstallments(db, { classId });
  const term = (options.q ?? "").trim().toLowerCase().slice(0, 100);
  const searched = term ? all.filter(({ row }) => {
    const student = row.enrollment.student;
    return [student.fullName, student.code, student.parentName, student.parentPhone].some((value) => value.toLowerCase().includes(term));
  }) : all;
  const states: readonly InstallmentState[] = dueViews[options.view].states;
  return { summary: summarizeDue(searched), rows: searched.filter(({ item }) => states.includes(item.state)) };
}

export function dueCsv(rows: Awaited<ReturnType<typeof dueReport>>["rows"]) {
  return toCsv(
    ["Mã HS", "Học sinh", "Phụ huynh", "SĐT phụ huynh", "Lớp", "Đợt", "Hạn đóng", "Số tiền đợt", "Còn thiếu", "Tình trạng"],
    rows.map(({ row, item }) => [
      row.enrollment.student.code, row.enrollment.student.fullName, row.enrollment.student.parentName, row.enrollment.student.parentPhone,
      row.enrollment.classGroup.code, `${item.sequence}/${row.installments.length}`, dateOnlyKey(item.dueDate), item.amountVnd, item.outstandingVnd,
      installmentStateText(item),
    ]),
  );
}

/** Minimum gap between two reminders for the same enrollment so parents are not spammed. */
export const REMINDER_COOLDOWN_HOURS = 20;

/** Sends an in-app fee reminder to the student/parent account for the unpaid amount that is due or due soon. */
export async function sendFeeReminder(db: PrismaClient, actor: Actor, enrollmentId: string) {
  assertManager(actor);
  const [row] = await feeLedger(db, { includeInactive: true, ...(await enrollmentScope(db, enrollmentId)) });
  if (!row) throw new RequestError(404, "Không tìm thấy ghi danh.");
  const due = row.installments.filter((item) => item.outstandingVnd > 0 && item.state !== "UPCOMING");
  if (!due.length) throw new RequestError(422, "Chưa có khoản nào đến hạn hoặc sắp đến hạn để nhắc.");
  const userId = row.enrollment.student.userId;
  if (!userId) throw new RequestError(422, "Học sinh chưa có tài khoản để nhận nhắc nhở. Hãy liên hệ phụ huynh qua điện thoại.");
  const since = new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3_600_000);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fee-reminder:${enrollmentId}`}))`;
    const recent = await tx.auditLog.findFirst({
      where: { action: "fee.reminded", entityType: "Enrollment", entityId: enrollmentId, createdAt: { gte: since } },
    });
    if (recent) throw new RequestError(409, `Vừa gửi nhắc cho khoản này trong ${REMINDER_COOLDOWN_HOURS} giờ qua, hãy thử lại sau.`);
    const amountVnd = due.reduce((sum, item) => sum + item.outstandingVnd, 0);
    const first = due[0];
    const when = first.state === "OVERDUE" ? `đã quá hạn ${-first.daysUntilDue} ngày`
      : first.state === "DUE_TODAY" ? "đến hạn hôm nay" : `đến hạn ngày ${formatDate(first.dueDate, true)}`;
    await notify(tx, [userId], {
      title: `Nhắc đóng học phí lớp ${row.enrollment.classGroup.name}`,
      body: `Khoản ${formatVnd(amountVnd)} ${when}. Vui lòng liên hệ giáo vụ nếu đã chuyển khoản.`,
      href: "/hoc-sinh/hoc-phi",
    });
    await audit(tx, actor, "fee.reminded", "Enrollment", enrollmentId, { amountVnd, state: first.state });
    return { amountVnd };
  });
}

/** Time of the latest reminder per enrollment. */
export async function lastReminders(db: PrismaClient, enrollmentIds: string[]) {
  if (!enrollmentIds.length) return new Map<string, Date>();
  const rows = await db.auditLog.groupBy({
    by: ["entityId"], where: { action: "fee.reminded", entityType: "Enrollment", entityId: { in: enrollmentIds } }, _max: { createdAt: true },
  });
  return new Map(rows.filter((row) => row._max.createdAt).map((row) => [row.entityId, row._max.createdAt as Date]));
}

async function enrollmentScope(db: PrismaClient, enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId }, select: { classId: true, studentId: true } });
  if (!enrollment) throw new RequestError(404, "Không tìm thấy ghi danh.");
  return { classId: enrollment.classId, studentIds: [enrollment.studentId] };
}

/** Payments received in a local date range (inclusive), newest first, with totals that exclude voided receipts. */
export async function paymentLedger(db: PrismaClient, options: { from: string; to: string; method?: string }) {
  const method = options.method === "CASH" || options.method === "TRANSFER" ? options.method : undefined;
  const payments = await db.payment.findMany({
    where: {
      paidAt: { gte: localDateTime(options.from, "00:00"), lt: localDateTime(addDays(options.to, 1), "00:00") },
      ...(method ? { method } : {}),
    },
    include: {
      receivedBy: { select: { displayName: true } },
      enrollment: { select: { student: { select: { id: true, code: true, fullName: true } }, classGroup: { select: { code: true } } } },
    },
    orderBy: [{ paidAt: "desc" }, { receiptNo: "desc" }],
    take: 2000,
  });
  const valid = payments.filter((payment) => !payment.voidedAt);
  const sum = (items: typeof payments) => items.reduce((total, payment) => total + payment.amountVnd, 0);
  return {
    payments,
    totals: {
      all: sum(valid), cash: sum(valid.filter((payment) => payment.method === "CASH")),
      transfer: sum(valid.filter((payment) => payment.method === "TRANSFER")), count: valid.length, voided: payments.length - valid.length,
    },
  };
}

export function paymentLedgerCsv(ledger: Awaited<ReturnType<typeof paymentLedger>>) {
  return toCsv(
    ["Số phiếu", "Ngày thu", "Mã HS", "Học sinh", "Lớp", "Số tiền", "Hình thức", "Người thu", "Ghi chú", "Đã hủy", "Lý do hủy"],
    ledger.payments.map((payment) => [
      payment.receiptNo, localDateKey(payment.paidAt), payment.enrollment.student.code, payment.enrollment.student.fullName,
      payment.enrollment.classGroup.code, payment.amountVnd, paymentMethodLabels[payment.method],
      payment.receivedBy.displayName, payment.note, payment.voidedAt ? "Có" : "", payment.voidReason,
    ]),
  );
}
