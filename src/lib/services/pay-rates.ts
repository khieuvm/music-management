import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertRole, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { dateOnly, dateOnlyKey } from "@/lib/time";
import { dateString, text, timeString, vnd } from "@/lib/validation";

const perHour = (label: string) => vnd(label).refine((value) => value <= 20_000_000, `${label} tối đa 20.000.000 đ.`);

export const payRateSchema = z.object({
  teacherId: z.string().trim().default(""),
  effectiveFrom: dateString("Ngày áp dụng"),
  hourlyVnd: perHour("Lương mỗi giờ"),
  eveningExtraVnd: perHour("Phụ cấp buổi tối mỗi giờ").default(0),
  weekendExtraVnd: perHour("Phụ cấp cuối tuần mỗi giờ").default(0),
  perLessonVnd: perHour("Phụ cấp mỗi buổi").default(0),
  eveningStart: timeString("Giờ bắt đầu buổi tối").default("18:00"),
  note: text(300, "Ghi chú"),
});

export function listPayRates(db: PrismaClient) {
  return db.payRate.findMany({
    include: { teacher: { select: { id: true, fullName: true } }, createdBy: { select: { displayName: true } } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

/** Rates are versioned: changing a rate means adding a new one from a later date, so past months stay reproducible. */
export async function createPayRate(db: PrismaClient, actor: Actor, raw: unknown) {
  assertRole(actor, "ADMIN");
  const input = payRateSchema.parse(raw);
  const teacherId = input.teacherId || null;
  if (teacherId) {
    if (!z.uuid().safeParse(teacherId).success || !(await db.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }))) {
      throw new RequestError(422, "Giáo viên không hợp lệ.");
    }
  }
  const effectiveFrom = dateOnly(input.effectiveFrom);
  const existing = await db.payRate.findFirst({ where: { teacherId, effectiveFrom }, select: { id: true } });
  if (existing) throw new RequestError(409, "Đã có đơn giá áp dụng từ ngày này. Hãy xóa đơn giá cũ hoặc chọn ngày khác.");
  const [hours, minutes] = input.eveningStart.split(":").map(Number);
  return db.$transaction(async (tx) => {
    const rate = await tx.payRate.create({
      data: {
        teacherId, effectiveFrom,
        hourlyVnd: input.hourlyVnd, eveningExtraVnd: input.eveningExtraVnd, weekendExtraVnd: input.weekendExtraVnd,
        perLessonVnd: input.perLessonVnd, eveningStartMinutes: hours * 60 + minutes, note: input.note, createdById: actor.userId,
      },
    });
    await audit(tx, actor, "payRate.create", "PayRate", rate.id, {
      teacherId, effectiveFrom: input.effectiveFrom, hourlyVnd: rate.hourlyVnd, eveningExtraVnd: rate.eveningExtraVnd,
      weekendExtraVnd: rate.weekendExtraVnd, perLessonVnd: rate.perLessonVnd, eveningStart: input.eveningStart,
    });
    return rate;
  });
}

export async function deletePayRate(db: PrismaClient, actor: Actor, id: string) {
  assertRole(actor, "ADMIN");
  if (!z.uuid().safeParse(id).success) throw new RequestError(404, "Không tìm thấy đơn giá.");
  return db.$transaction(async (tx) => {
    const rate = await tx.payRate.findUnique({ where: { id } });
    if (!rate) throw new RequestError(404, "Không tìm thấy đơn giá.");
    await tx.payRate.delete({ where: { id } });
    await audit(tx, actor, "payRate.delete", "PayRate", id, {
      teacherId: rate.teacherId, effectiveFrom: dateOnlyKey(rate.effectiveFrom), hourlyVnd: rate.hourlyVnd,
    });
  });
}
