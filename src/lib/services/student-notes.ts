import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { assertClassTeacherOrManager } from "@/lib/services/assignments";
import { audit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { checkbox, requiredText } from "@/lib/validation";

export const studentNoteSchema = z.object({
  content: requiredText(2000, "Nhận xét", 2),
  shared: checkbox,
});

async function enrollmentInClass(db: PrismaClient, classId: string, studentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
    include: { student: { select: { id: true, code: true, fullName: true, userId: true } } },
  });
  if (!enrollment) throw new RequestError(404, "Học sinh không thuộc lớp này.");
  return enrollment;
}

export async function addStudentNote(db: PrismaClient, actor: Actor, classId: string, studentId: string, raw: unknown) {
  const input = studentNoteSchema.parse(raw);
  await assertClassTeacherOrManager(db, actor, classId);
  const enrollment = await enrollmentInClass(db, classId, studentId);
  return db.$transaction(async (tx) => {
    const note = await tx.studentNote.create({ data: { classId, studentId, authorId: actor.userId, ...input } });
    if (input.shared) {
      const classGroup = await tx.classGroup.findUniqueOrThrow({ where: { id: classId }, select: { name: true } });
      await notify(tx, [enrollment.student.userId], {
        title: `Nhận xét mới từ giáo viên — ${classGroup.name}`, body: input.content.slice(0, 200), href: "/hoc-sinh",
      });
    }
    await audit(tx, actor, "studentNote.created", "StudentNote", note.id, { classId, studentId, shared: input.shared });
    return note;
  });
}

/** Authors may remove their own notes; staff may remove any. */
export async function deleteStudentNote(db: PrismaClient, actor: Actor, noteId: string) {
  const note = await db.studentNote.findUnique({ where: { id: noteId } });
  if (!note) throw new RequestError(404, "Không tìm thấy nhận xét.");
  if (!isManager(actor)) {
    await assertClassTeacherOrManager(db, actor, note.classId);
    if (note.authorId !== actor.userId) throw new RequestError(403, "Chỉ xóa được nhận xét do bạn viết.");
  }
  await db.$transaction(async (tx) => {
    await tx.studentNote.delete({ where: { id: note.id } });
    await audit(tx, actor, "studentNote.deleted", "StudentNote", note.id, { classId: note.classId, studentId: note.studentId });
  });
}

/** Everything a teacher needs about one student in one class: attendance, homework, absences and notes. */
export async function getStudentInClass(db: PrismaClient, actor: Actor, classId: string, studentId: string) {
  await assertClassTeacherOrManager(db, actor, classId);
  const enrollment = await enrollmentInClass(db, classId, studentId);
  const classGroup = await db.classGroup.findUniqueOrThrow({ where: { id: classId }, select: { id: true, code: true, name: true } });
  const [lessons, assignments, notes, absences] = await Promise.all([
    db.lesson.findMany({
      where: { classId, startsAt: { lte: new Date() }, endsAt: { gte: enrollment.enrolledAt }, status: { not: "CANCELLED" } },
      include: { attendance: { where: { studentId } } },
      orderBy: { startsAt: "desc" },
    }),
    db.assignment.findMany({
      where: { classId },
      include: { submissions: { where: { studentId }, orderBy: { attempt: "desc" }, take: 1, include: { videoFile: { select: { id: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.studentNote.findMany({
      where: { classId, studentId }, include: { author: { select: { displayName: true } } }, orderBy: { createdAt: "desc" },
    }),
    db.absenceRequest.findMany({
      where: { studentId, lesson: { classId } }, include: { lesson: { select: { id: true, startsAt: true } } },
      orderBy: { lesson: { startsAt: "desc" } },
    }),
  ]);
  const visibleLessons = lessons.filter((lesson) => !enrollment.withdrawnAt || enrollment.withdrawnAt > lesson.startsAt);
  return { classGroup, enrollment, student: enrollment.student, lessons: visibleLessons, assignments, notes, absences };
}

export type AttendanceSummary = { recorded: number; attended: number; excused: number; absent: number };

export function summarizeAttendance(statuses: string[]): AttendanceSummary {
  return {
    recorded: statuses.length,
    attended: statuses.filter((status) => status === "PRESENT" || status === "LATE").length,
    excused: statuses.filter((status) => status === "EXCUSED").length,
    absent: statuses.filter((status) => status === "ABSENT").length,
  };
}

/** Per-student progress for a class roster. Caller must already have checked access to the class. */
export async function classProgress(db: PrismaClient, classId: string) {
  const [attendance, submissions, assignmentCount, notes] = await Promise.all([
    db.attendance.findMany({ where: { lesson: { classId } }, select: { studentId: true, status: true } }),
    db.submission.findMany({
      where: { assignment: { classId } }, select: { studentId: true, assignmentId: true, status: true, attempt: true },
      orderBy: { attempt: "desc" },
    }),
    db.assignment.count({ where: { classId } }),
    db.studentNote.groupBy({ by: ["studentId"], where: { classId }, _max: { createdAt: true } }),
  ]);
  const latest = new Map<string, string>();
  for (const item of submissions) {
    const key = `${item.studentId}:${item.assignmentId}`;
    if (!latest.has(key)) latest.set(key, item.status);
  }
  const progress = new Map<string, { attendance: AttendanceSummary; submitted: number; waiting: number; lastNoteAt: Date | null }>();
  const ensure = (studentId: string) => {
    let entry = progress.get(studentId);
    if (!entry) {
      entry = { attendance: summarizeAttendance([]), submitted: 0, waiting: 0, lastNoteAt: null };
      progress.set(studentId, entry);
    }
    return entry;
  };
  const statuses = new Map<string, string[]>();
  for (const row of attendance) statuses.set(row.studentId, [...(statuses.get(row.studentId) ?? []), row.status]);
  for (const [studentId, list] of statuses) ensure(studentId).attendance = summarizeAttendance(list);
  for (const [key, status] of latest) {
    const entry = ensure(key.split(":")[0]);
    entry.submitted += 1;
    if (status === "SUBMITTED") entry.waiting += 1;
  }
  for (const row of notes) ensure(row.studentId).lastNoteAt = row._max.createdAt;
  return { assignmentCount, get: (studentId: string) => progress.get(studentId) ?? ensure(studentId) };
}
