import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { lessonRosterWhere } from "@/lib/services/classes";
import { notify, teacherUserId } from "@/lib/services/notifications";
import { formatDateTime } from "@/lib/time";
import { requiredText } from "@/lib/validation";

export const absenceSchema = z.object({ reason: requiredText(500, "Lý do xin nghỉ", 2) });

function requireStudentActor(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.studentId) throw new RequestError(403, "Chỉ tài khoản học sinh được gửi đơn xin nghỉ.");
  return actor.studentId;
}

/** Student/parent notifies the centre that they will miss a lesson that has not started yet. */
export async function requestAbsence(db: PrismaClient, actor: Actor, lessonId: string, raw: unknown) {
  const studentId = requireStudentActor(actor);
  const input = absenceSchema.parse(raw);
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId }, include: { classGroup: { select: { name: true } } },
  });
  if (!lesson) throw new RequestError(404, "Không tìm thấy buổi học.");
  const enrolled = await db.enrollment.count({ where: { ...lessonRosterWhere(lesson.classId, lesson), studentId, status: "ACTIVE" } });
  if (!enrolled) throw new RequestError(404, "Không tìm thấy buổi học.");
  if (lesson.status !== "SCHEDULED") throw new RequestError(422, "Buổi học đã hủy hoặc đã điểm danh.");
  if (lesson.startsAt <= new Date()) throw new RequestError(422, "Buổi học đã bắt đầu; vui lòng liên hệ trực tiếp giáo viên hoặc giáo vụ.");

  return db.$transaction(async (tx) => {
    const existing = await tx.absenceRequest.findUnique({ where: { lessonId_studentId: { lessonId, studentId } } });
    if (existing && existing.status !== "CANCELLED") throw new RequestError(409, "Bạn đã gửi đơn xin nghỉ cho buổi này.");
    const data = { reason: input.reason, status: "PENDING" as const, createdById: actor.userId, acknowledgedAt: null, acknowledgedById: null };
    const request = existing
      ? await tx.absenceRequest.update({ where: { id: existing.id }, data })
      : await tx.absenceRequest.create({ data: { ...data, lessonId, studentId } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { fullName: true } });
    await notify(tx, [await teacherUserId(tx, lesson.teacherId)], {
      title: `${student.fullName} xin nghỉ buổi ${formatDateTime(lesson.startsAt)}`,
      body: `${lesson.classGroup.name}: ${input.reason}`,
      href: `/giao-vien/buoi/${lesson.id}`,
    });
    await audit(tx, actor, "absence.requested", "AbsenceRequest", request.id, { lessonId });
    return request;
  });
}

export async function cancelAbsence(db: PrismaClient, actor: Actor, requestId: string) {
  const studentId = requireStudentActor(actor);
  const request = await db.absenceRequest.findUnique({ where: { id: requestId }, include: { lesson: true } });
  if (!request || request.studentId !== studentId) throw new RequestError(404, "Không tìm thấy đơn xin nghỉ.");
  if (request.status === "CANCELLED") return;
  if (request.lesson.startsAt <= new Date() || request.lesson.status !== "SCHEDULED") {
    throw new RequestError(422, "Buổi học đã bắt đầu; không thể rút đơn.");
  }
  await db.$transaction(async (tx) => {
    await tx.absenceRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { fullName: true } });
    await notify(tx, [await teacherUserId(tx, request.lesson.teacherId)], {
      title: `${student.fullName} rút đơn xin nghỉ buổi ${formatDateTime(request.lesson.startsAt)}`,
      href: `/giao-vien/buoi/${request.lessonId}`,
    });
    await audit(tx, actor, "absence.cancelled", "AbsenceRequest", request.id);
  });
}

/** Teacher of the lesson (or staff) confirms they have seen the request. */
export async function acknowledgeAbsence(db: PrismaClient, actor: Actor, requestId: string) {
  const request = await db.absenceRequest.findUnique({ where: { id: requestId }, include: { lesson: { select: { teacherId: true } } } });
  if (!request) throw new RequestError(404, "Không tìm thấy đơn xin nghỉ.");
  if (!isManager(actor) && !(actor.role === "TEACHER" && actor.teacherId === request.lesson.teacherId)) {
    throw new RequestError(403, "Bạn không được phân công buổi học này.");
  }
  if (request.status !== "PENDING") return;
  await db.$transaction(async (tx) => {
    await tx.absenceRequest.update({
      where: { id: request.id }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: actor.userId },
    });
    await audit(tx, actor, "absence.acknowledged", "AbsenceRequest", request.id);
  });
}
