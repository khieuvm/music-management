import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { lessonRosterWhere } from "@/lib/services/classes";
import { text } from "@/lib/validation";

/** Teachers can record or correct attendance until this many hours after a lesson ends. */
export const TEACHER_EDIT_HOURS = 48;

export function teacherEditDeadline(lesson: { endsAt: Date }) {
  return new Date(lesson.endsAt.getTime() + TEACHER_EDIT_HOURS * 3_600_000);
}

export async function getLessonForAttendance(db: PrismaClient, actor: Actor, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      classGroup: { include: { course: { select: { title: true } } } },
      teacher: { select: { id: true, fullName: true } },
      attendance: true,
      absences: { where: { status: { not: "CANCELLED" } } },
    },
  });
  if (!lesson) throw new RequestError(404, "Không tìm thấy buổi học.");
  if (!isManager(actor) && !(actor.role === "TEACHER" && actor.teacherId === lesson.teacherId)) {
    throw new RequestError(403, "Bạn không được phân công buổi học này.");
  }
  const roster = await db.enrollment.findMany({
    where: lessonRosterWhere(lesson.classId, lesson),
    include: { student: { select: { id: true, code: true, fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return { lesson, roster: roster.map((item) => item.student) };
}

export const attendanceSchema = z.object({
  topic: text(300, "Nội dung buổi học"),
  teacherNote: text(1000, "Ghi chú buổi học"),
  overrideReason: text(300, "Lý do sửa"),
  entries: z.array(z.object({
    studentId: z.uuid(),
    status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"], "Vui lòng chọn trạng thái điểm danh cho mọi học sinh."),
    comment: text(1000, "Nhận xét"),
  })),
});

/** Saves attendance for every student and confirms the lesson as taught (used later for payroll). */
export async function saveAttendance(db: PrismaClient, actor: Actor, lessonId: string, raw: unknown) {
  const input = attendanceSchema.parse(raw);
  const { lesson, roster } = await getLessonForAttendance(db, actor, lessonId);
  const now = new Date();
  if (lesson.status === "CANCELLED") throw new RequestError(422, "Buổi học đã bị hủy.");
  if (lesson.startsAt > now) throw new RequestError(422, "Chỉ điểm danh khi buổi học đã bắt đầu.");
  const overdue = now > teacherEditDeadline(lesson);
  if (overdue && !isManager(actor)) {
    throw new RequestError(403, `Đã quá ${TEACHER_EDIT_HOURS} giờ sau buổi học. Vui lòng liên hệ giáo vụ để sửa.`);
  }
  if (overdue && !input.overrideReason) throw new RequestError(422, "Buổi học đã quá hạn sửa; vui lòng nhập lý do.");

  const rosterIds = new Set(roster.map((student) => student.id));
  const submitted = new Map(input.entries.map((entry) => [entry.studentId, entry]));
  if (submitted.size !== input.entries.length) throw new RequestError(422, "Danh sách điểm danh bị trùng học sinh.");
  for (const id of submitted.keys()) {
    if (!rosterIds.has(id)) throw new RequestError(422, "Có học sinh không thuộc lớp tại thời điểm buổi học.");
  }
  if (submitted.size !== rosterIds.size) throw new RequestError(422, "Vui lòng điểm danh đủ tất cả học sinh.");

  await db.$transaction(async (tx) => {
    const current = await tx.lesson.updateMany({
      where: { id: lesson.id, status: { not: "CANCELLED" } },
      data: { status: "COMPLETED", completedAt: lesson.completedAt ?? now, topic: input.topic, teacherNote: input.teacherNote },
    });
    if (current.count !== 1) throw new RequestError(409, "Buổi học vừa bị hủy.");
    for (const entry of input.entries) {
      await tx.attendance.upsert({
        where: { lessonId_studentId: { lessonId: lesson.id, studentId: entry.studentId } },
        create: { lessonId: lesson.id, ...entry, updatedById: actor.userId },
        update: { status: entry.status, comment: entry.comment, updatedById: actor.userId },
      });
    }
    await tx.absenceRequest.updateMany({
      where: { lessonId: lesson.id, status: "PENDING" },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: now, acknowledgedById: actor.userId },
    });
    await audit(tx, actor, lesson.status === "COMPLETED" ? "attendance.updated" : "attendance.recorded", "Lesson", lesson.id, {
      students: input.entries.length, ...(overdue ? { overrideReason: input.overrideReason } : {}),
    });
  });
}
