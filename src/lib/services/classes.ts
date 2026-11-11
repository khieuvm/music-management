import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { assertManager, type Actor } from "@/lib/access";
import { classTransitions } from "@/lib/class-status";
import { splitInstallments } from "@/lib/fees";
import { RequestError } from "@/lib/http";
import { classStatusLabels } from "@/lib/labels";
import { generateOccurrences, type WeeklyPattern } from "@/lib/schedule";
import { audit } from "@/lib/services/audit";
import { classStudentUserIds, notify, teacherUserId } from "@/lib/services/notifications";
import { dateOnly, formatDateTime, localDateKey, localDateTime } from "@/lib/time";
import { dateString, optionalDate, positiveInt, requiredText, text, timeString, url, uuid, vnd } from "@/lib/validation";

export const classSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,30}$/, "Mã lớp 2–30 ký tự, gồm chữ không dấu, số hoặc gạch ngang."),
  name: requiredText(150, "Tên lớp", 2),
  courseId: uuid("Khóa học"),
  teacherId: uuid("Giáo viên"),
  deliveryMode: z.enum(["OFFLINE", "ONLINE"]),
  format: z.enum(["GROUP", "INDIVIDUAL"]),
  capacity: positiveInt("Sĩ số tối đa", 200),
  tuitionVnd: vnd("Học phí cả khóa"),
  location: text(200, "Địa điểm / phòng"),
  meetingUrl: url,
  startDate: dateString("Ngày bắt đầu"),
  endDate: optionalDate("Ngày kết thúc"),
  status: z.enum(["PLANNED", "ACTIVE", "FINISHED", "CANCELLED"]).default("PLANNED"),
}).refine((value) => value.format === "GROUP" || value.capacity === 1, {
  message: "Lớp kèm 1–1 chỉ có sĩ số tối đa 1.", path: ["capacity"],
}).refine((value) => !value.endDate || value.endDate >= value.startDate, {
  message: "Ngày kết thúc phải sau ngày bắt đầu.", path: ["endDate"],
});
export type ClassInput = z.input<typeof classSchema>;

function overlapWhere(teacherId: string, slots: { startsAt: Date; endsAt: Date }[], excludeLessonId?: string): Prisma.LessonWhereInput {
  return {
    teacherId,
    status: { not: "CANCELLED" },
    ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}),
    OR: slots.map((slot) => ({ startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } })),
  };
}

async function assertNoTeacherConflict(
  tx: Prisma.TransactionClient, teacherId: string, slots: { startsAt: Date; endsAt: Date }[], excludeLessonId?: string,
) {
  if (!slots.length) return;
  const conflicts = await tx.lesson.findMany({
    where: overlapWhere(teacherId, slots, excludeLessonId),
    include: { classGroup: { select: { code: true } } },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  if (conflicts.length) {
    const list = conflicts.map((lesson) => `${lesson.classGroup.code} lúc ${formatDateTime(lesson.startsAt)}`).join("; ");
    throw new RequestError(409, `Giáo viên bị trùng lịch với: ${list}.`);
  }
}

type RoomOwner = { id: string; deliveryMode: string; location: string };

/** Offline classes sharing the same room (location text, case-insensitive) must not overlap. */
async function assertNoRoomConflict(
  tx: Prisma.TransactionClient, classGroup: RoomOwner, slots: { startsAt: Date; endsAt: Date }[], excludeLessonId?: string,
) {
  const room = classGroup.location.trim();
  if (classGroup.deliveryMode !== "OFFLINE" || !room || !slots.length) return;
  const conflicts = await tx.lesson.findMany({
    where: {
      status: { not: "CANCELLED" },
      classId: { not: classGroup.id },
      ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}),
      classGroup: { deliveryMode: "OFFLINE", location: { equals: room, mode: "insensitive" } },
      OR: slots.map((slot) => ({ startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } })),
    },
    include: { classGroup: { select: { code: true } } },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  if (conflicts.length) {
    const list = conflicts.map((lesson) => `${lesson.classGroup.code} lúc ${formatDateTime(lesson.startsAt)}`).join("; ");
    throw new RequestError(409, `Phòng “${room}” đã có lớp khác: ${list}.`);
  }
}

async function activeTeacher(tx: Prisma.TransactionClient, teacherId: string) {
  const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.status !== "ACTIVE") throw new RequestError(422, "Giáo viên không tồn tại hoặc đã ngừng hoạt động.");
  return teacher;
}

export async function saveClass(db: PrismaClient, actor: Actor, classId: string | null, raw: unknown) {
  assertManager(actor);
  const input = classSchema.parse(raw);
  const data = { ...input, startDate: dateOnly(input.startDate), endDate: input.endDate ? dateOnly(input.endDate) : null };
  return db.$transaction(async (tx) => {
    if (!await tx.course.findUnique({ where: { id: input.courseId }, select: { id: true } })) {
      throw new RequestError(422, "Khóa học không tồn tại.");
    }
    if (!classId) {
      if (input.status !== "PLANNED" && input.status !== "ACTIVE") throw new RequestError(422, "Lớp mới chỉ có thể ở trạng thái Sắp mở hoặc Đang học.");
      await activeTeacher(tx, input.teacherId);
      const created = await tx.classGroup.create({ data });
      await audit(tx, actor, "class.created", "ClassGroup", created.id, { code: created.code });
      return created;
    }
    await tx.$queryRaw`SELECT id FROM "ClassGroup" WHERE id = ${classId}::uuid FOR UPDATE`;
    const current = await tx.classGroup.findUnique({ where: { id: classId } });
    if (!current) throw new RequestError(404, "Không tìm thấy lớp.");
    const activeCount = await tx.enrollment.count({ where: { classId, status: "ACTIVE" } });
    if (input.capacity < activeCount && !["FINISHED", "CANCELLED"].includes(current.status)) {
      throw new RequestError(422, `Lớp đang có ${activeCount} học sinh; sĩ số tối đa không thể nhỏ hơn.`);
    }
    const roomChanged = current.location.trim().toLowerCase() !== input.location.trim().toLowerCase()
      || current.deliveryMode !== input.deliveryMode;
    if (roomChanged && current.status !== "CANCELLED") {
      const future = await tx.lesson.findMany({
        where: { classId, status: "SCHEDULED", startsAt: { gt: new Date() } }, select: { startsAt: true, endsAt: true },
      });
      await assertNoRoomConflict(tx, { id: classId, deliveryMode: input.deliveryMode, location: input.location }, future);
    }
    let movedLessons = 0;
    if (current.teacherId !== input.teacherId) {
      await activeTeacher(tx, input.teacherId);
      const future = await tx.lesson.findMany({
        where: { classId, teacherId: current.teacherId, status: "SCHEDULED", startsAt: { gt: new Date() } },
        select: { id: true, startsAt: true, endsAt: true },
      });
      await assertNoTeacherConflict(tx, input.teacherId, future);
      movedLessons = (await tx.lesson.updateMany({
        where: { id: { in: future.map((lesson) => lesson.id) } }, data: { teacherId: input.teacherId },
      })).count;
    }
    // Status is changed only through changeClassStatus so its checks and side effects always run.
    const updated = await tx.classGroup.update({ where: { id: classId }, data: { ...data, status: current.status } });
    await audit(tx, actor, "class.updated", "ClassGroup", classId, { movedLessons });
    return updated;
  });
}

export const classStatusSchema = z.object({
  status: z.enum(["PLANNED", "ACTIVE", "FINISHED", "CANCELLED"], "Trạng thái không hợp lệ."),
  reason: text(300, "Lý do"),
});

/** Validated class lifecycle change with its side effects (lessons, enrollments, notifications). */
export async function changeClassStatus(db: PrismaClient, actor: Actor, classId: string, raw: unknown) {
  assertManager(actor);
  const input = classStatusSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ClassGroup" WHERE id = ${classId}::uuid FOR UPDATE`;
    const current = await tx.classGroup.findUnique({ where: { id: classId } });
    if (!current) throw new RequestError(404, "Không tìm thấy lớp.");
    if (!classTransitions[current.status].includes(input.status)) {
      throw new RequestError(422, `Không thể chuyển lớp từ “${classStatusLabels[current.status]}” sang “${classStatusLabels[input.status]}”.`);
    }
    const now = new Date();
    let detail = "";
    if (input.status === "FINISHED") {
      const pending = await tx.lesson.count({ where: { classId, status: "SCHEDULED", endsAt: { lt: now } } });
      if (pending) throw new RequestError(422, `Còn ${pending} buổi đã qua chưa điểm danh. Hãy điểm danh hoặc hủy các buổi đó trước khi kết thúc lớp.`);
      const upcoming = await tx.lesson.count({ where: { classId, status: "SCHEDULED", startsAt: { gte: now } } });
      if (upcoming) throw new RequestError(422, `Lớp còn ${upcoming} buổi chưa học. Hãy hủy các buổi còn lại nếu muốn kết thúc sớm.`);
      const { count } = await tx.enrollment.updateMany({ where: { classId, status: "ACTIVE" }, data: { status: "COMPLETED" } });
      detail = `${count} học sinh được đánh dấu hoàn thành.`;
    }
    if (input.status === "CANCELLED") {
      if (!input.reason) throw new RequestError(422, "Nhập lý do hủy lớp.");
      const { count } = await tx.lesson.updateMany({
        where: { classId, status: "SCHEDULED", startsAt: { gt: now } }, data: { status: "CANCELLED", cancelReason: `Lớp đã hủy: ${input.reason}`.slice(0, 300) },
      });
      detail = `Đã hủy ${count} buổi sắp tới. Nếu cần hoàn/giảm học phí, hãy điều chỉnh ở hồ sơ từng học sinh.`;
    }
    if (current.status === "FINISHED" && input.status === "ACTIVE") {
      const { count } = await tx.enrollment.updateMany({ where: { classId, status: "COMPLETED" }, data: { status: "ACTIVE" } });
      detail = `${count} học sinh được đưa lại về trạng thái đang học.`;
    }
    const updated = await tx.classGroup.update({ where: { id: classId }, data: { status: input.status } });
    if (input.status === "FINISHED" || input.status === "CANCELLED") {
      const title = input.status === "FINISHED" ? `Lớp ${current.name} đã kết thúc` : `Lớp ${current.name} đã bị hủy`;
      await notify(tx, [...await classStudentUserIds(tx, classId), ...await completedStudentUserIds(tx, classId), await teacherUserId(tx, current.teacherId)], {
        title, body: input.reason, href: "",
      }, actor.userId);
    }
    await audit(tx, actor, "class.status_changed", "ClassGroup", classId, { from: current.status, to: input.status, reason: input.reason });
    return { classGroup: updated, detail };
  });
}

async function completedStudentUserIds(tx: Prisma.TransactionClient, classId: string) {
  const rows = await tx.enrollment.findMany({ where: { classId, status: "COMPLETED" }, select: { student: { select: { userId: true } } } });
  return rows.map((row) => row.student.userId);
}

export const enrollSchema = z.object({
  studentId: uuid("Học sinh"),
  tuitionVnd: z.string().trim().default(""),
  installmentCount: positiveInt("Số đợt đóng phí", 12),
  firstDueDate: dateString("Hạn đóng đợt đầu"),
  note: text(500, "Ghi chú"),
});

export async function enrollStudent(db: PrismaClient, actor: Actor, classId: string, raw: unknown) {
  assertManager(actor);
  const input = enrollSchema.parse(raw);
  return db.$transaction(async (tx) => {
    // Row lock serializes concurrent enrollments into the same class so capacity cannot be exceeded.
    await tx.$queryRaw`SELECT id FROM "ClassGroup" WHERE id = ${classId}::uuid FOR UPDATE`;
    const classGroup = await tx.classGroup.findUnique({ where: { id: classId } });
    if (!classGroup) throw new RequestError(404, "Không tìm thấy lớp.");
    if (!["PLANNED", "ACTIVE"].includes(classGroup.status)) throw new RequestError(422, "Lớp đã kết thúc hoặc bị hủy.");
    const student = await tx.student.findUnique({ where: { id: input.studentId } });
    if (!student || student.status !== "ACTIVE") throw new RequestError(422, "Học sinh không tồn tại hoặc không ở trạng thái đang học.");
    const activeCount = await tx.enrollment.count({ where: { classId, status: "ACTIVE" } });
    if (activeCount >= classGroup.capacity) throw new RequestError(409, `Lớp đã đủ sĩ số (${classGroup.capacity}).`);

    const existing = await tx.enrollment.findUnique({ where: { studentId_classId: { studentId: student.id, classId } } });
    if (existing?.status === "ACTIVE") throw new RequestError(409, "Học sinh đã có trong lớp.");
    if (existing) {
      const restored = await tx.enrollment.update({
        where: { id: existing.id }, data: { status: "ACTIVE", withdrawnAt: null },
      });
      await audit(tx, actor, "enrollment.restored", "Enrollment", existing.id);
      return { enrollment: restored, restored: true };
    }
    const tuitionVnd = input.tuitionVnd === "" ? classGroup.tuitionVnd : vnd("Học phí").parse(input.tuitionVnd);
    const enrollment = await tx.enrollment.create({
      data: {
        studentId: student.id, classId, tuitionVnd, note: input.note,
        installments: { create: splitInstallments(tuitionVnd, input.installmentCount, input.firstDueDate) },
      },
    });
    await audit(tx, actor, "enrollment.created", "Enrollment", enrollment.id, { classId, studentId: student.id, tuitionVnd });
    return { enrollment, restored: false };
  });
}

export async function withdrawEnrollment(db: PrismaClient, actor: Actor, enrollmentId: string, reason: string) {
  assertManager(actor);
  const cleanReason = text(300, "Lý do").parse(reason);
  if (!cleanReason) throw new RequestError(422, "Vui lòng nhập lý do rút khỏi lớp.");
  await db.$transaction(async (tx) => {
    const updated = await tx.enrollment.updateMany({
      where: { id: enrollmentId, status: "ACTIVE" }, data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    if (updated.count !== 1) throw new RequestError(409, "Ghi danh không còn ở trạng thái đang học.");
    await audit(tx, actor, "enrollment.withdrawn", "Enrollment", enrollmentId, { reason: cleanReason });
  });
}

export const scheduleSchema = z.object({
  fromDate: dateString("Từ ngày"),
  toDate: dateString("Đến ngày"),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Chọn ít nhất một ngày trong tuần."),
  startTime: timeString("Giờ bắt đầu"),
  durationMinutes: positiveInt("Thời lượng", 600),
});

export async function generateLessons(db: PrismaClient, actor: Actor, classId: string, raw: unknown) {
  assertManager(actor);
  const pattern: WeeklyPattern = scheduleSchema.parse(raw);
  const slots = generateOccurrences(pattern);
  if (!slots.length) throw new RequestError(422, "Không có ngày nào khớp lịch trong khoảng đã chọn.");
  return db.$transaction(async (tx) => {
    const classGroup = await tx.classGroup.findUnique({ where: { id: classId } });
    if (!classGroup) throw new RequestError(404, "Không tìm thấy lớp.");
    if (!["PLANNED", "ACTIVE"].includes(classGroup.status)) throw new RequestError(422, "Lớp đã kết thúc hoặc bị hủy.");
    await activeTeacher(tx, classGroup.teacherId);
    await assertNoTeacherConflict(tx, classGroup.teacherId, slots);
    await assertNoRoomConflict(tx, classGroup, slots);
    const created = await tx.lesson.createMany({
      data: slots.map((slot) => ({ ...slot, classId, teacherId: classGroup.teacherId })),
    });
    await audit(tx, actor, "lesson.generated", "ClassGroup", classId, { count: created.count, ...pattern });
    return created.count;
  });
}

export const lessonUpdateSchema = z.object({
  date: dateString("Ngày học"),
  startTime: timeString("Giờ bắt đầu"),
  durationMinutes: positiveInt("Thời lượng", 600),
  teacherId: uuid("Giáo viên"),
});

export async function updateLesson(db: PrismaClient, actor: Actor, lessonId: string, raw: unknown) {
  assertManager(actor);
  const input = lessonUpdateSchema.parse(raw);
  const startsAt = localDateTime(input.date, input.startTime);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  await db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({ where: { id: lessonId }, include: { classGroup: true } });
    if (!lesson) throw new RequestError(404, "Không tìm thấy buổi học.");
    if (lesson.status !== "SCHEDULED") throw new RequestError(422, "Chỉ đổi được buổi chưa diễn ra hoặc chưa xác nhận.");
    await activeTeacher(tx, input.teacherId);
    await assertNoTeacherConflict(tx, input.teacherId, [{ startsAt, endsAt }], lesson.id);
    await assertNoRoomConflict(tx, lesson.classGroup, [{ startsAt, endsAt }], lesson.id);
    await tx.lesson.update({ where: { id: lesson.id }, data: { startsAt, endsAt, teacherId: input.teacherId } });
    const timeChanged = lesson.startsAt.getTime() !== startsAt.getTime() || lesson.endsAt.getTime() !== endsAt.getTime();
    const message = {
      title: `Đổi lịch ${lesson.classGroup.name}`,
      body: `Buổi ${formatDateTime(lesson.startsAt)} chuyển sang ${formatDateTime(startsAt)}.`,
    };
    if (timeChanged) {
      await notify(tx, await classStudentUserIds(tx, lesson.classId), { ...message, href: "/hoc-sinh/lich" });
      if (lesson.teacherId === input.teacherId) {
        await notify(tx, [await teacherUserId(tx, input.teacherId)], { ...message, href: `/giao-vien/buoi/${lesson.id}` });
      }
    }
    if (lesson.teacherId !== input.teacherId) {
      await notify(tx, [await teacherUserId(tx, input.teacherId)], {
        title: `Bạn được phân công dạy ${lesson.classGroup.name}`, body: `Buổi ${formatDateTime(startsAt)}.`, href: `/giao-vien/buoi/${lesson.id}`,
      });
      await notify(tx, [await teacherUserId(tx, lesson.teacherId)], {
        title: `Bạn không còn dạy buổi ${formatDateTime(lesson.startsAt)}`, body: lesson.classGroup.name, href: "/giao-vien",
      });
    }
    await audit(tx, actor, "lesson.updated", "Lesson", lesson.id, {
      from: lesson.startsAt.toISOString(), to: startsAt.toISOString(), teacherId: input.teacherId,
    });
  });
}

export async function cancelLesson(db: PrismaClient, actor: Actor, lessonId: string, reason: string) {
  assertManager(actor);
  const cleanReason = text(300, "Lý do").parse(reason);
  if (!cleanReason) throw new RequestError(422, "Vui lòng nhập lý do hủy buổi.");
  await db.$transaction(async (tx) => {
    const updated = await tx.lesson.updateMany({
      where: { id: lessonId, status: "SCHEDULED" }, data: { status: "CANCELLED", cancelReason: cleanReason },
    });
    if (updated.count !== 1) throw new RequestError(409, "Chỉ hủy được buổi chưa xác nhận dạy.");
    const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { classGroup: { select: { name: true } } } });
    if (lesson.startsAt > new Date()) {
      const message = { title: `Nghỉ buổi ${formatDateTime(lesson.startsAt)} — ${lesson.classGroup.name}`, body: `Lý do: ${cleanReason}` };
      await notify(tx, await classStudentUserIds(tx, lesson.classId), { ...message, href: "/hoc-sinh/lich" });
      await notify(tx, [await teacherUserId(tx, lesson.teacherId)], { ...message, href: "/giao-vien" });
    }
    await audit(tx, actor, "lesson.cancelled", "Lesson", lessonId, { reason: cleanReason });
  });
}

/** Students that belonged to the class at the time of the lesson. */
export function lessonRosterWhere(classId: string, lesson: { startsAt: Date; endsAt: Date }): Prisma.EnrollmentWhereInput {
  return {
    classId,
    enrolledAt: { lte: lesson.endsAt },
    OR: [{ withdrawnAt: null }, { withdrawnAt: { gt: lesson.startsAt } }],
  };
}

export function lessonDateKey(lesson: { startsAt: Date }) {
  return localDateKey(lesson.startsAt);
}
