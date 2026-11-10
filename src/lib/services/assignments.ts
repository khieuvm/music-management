import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { isManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { audit } from "@/lib/services/audit";
import { classStudentUserIds, notify, teacherUserId } from "@/lib/services/notifications";
import { formatDateTime, localDateTime } from "@/lib/time";
import { checkbox, requiredText, text } from "@/lib/validation";

export async function assertClassTeacherOrManager(db: PrismaClient, actor: Actor, classId: string) {
  const classGroup = await db.classGroup.findUnique({ where: { id: classId }, select: { id: true, teacherId: true, status: true } });
  if (!classGroup) throw new RequestError(404, "Không tìm thấy lớp.");
  if (!isManager(actor) && !(actor.role === "TEACHER" && actor.teacherId === classGroup.teacherId)) {
    throw new RequestError(403, "Bạn không phụ trách lớp này.");
  }
  return classGroup;
}

export const assignmentSchema = z.object({
  title: requiredText(200, "Tiêu đề bài tập", 2),
  instructions: text(5000, "Hướng dẫn"),
  dueAt: z.string().trim().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Hạn nộp không hợp lệ.").default(""),
  requireVideo: checkbox,
});

export async function createAssignment(db: PrismaClient, actor: Actor, classId: string, raw: unknown) {
  const input = assignmentSchema.parse(raw);
  const classGroup = await assertClassTeacherOrManager(db, actor, classId);
  if (!["PLANNED", "ACTIVE"].includes(classGroup.status)) throw new RequestError(422, "Lớp đã kết thúc hoặc bị hủy.");
  const dueAt = input.dueAt ? localDateTime(input.dueAt.slice(0, 10), input.dueAt.slice(11, 16)) : null;
  return db.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: { classId, title: input.title, instructions: input.instructions, dueAt, requireVideo: input.requireVideo, createdById: actor.userId },
    });
    await notify(tx, await classStudentUserIds(tx, classId), {
      title: `Bài tập mới: ${assignment.title}`,
      body: dueAt ? `Hạn nộp ${formatDateTime(dueAt)}` : "",
      href: `/hoc-sinh/bai-tap/${assignment.id}`,
    }, actor.userId);
    await audit(tx, actor, "assignment.created", "Assignment", assignment.id, { classId });
    return assignment;
  });
}

async function activeEnrollmentFor(db: PrismaClient, actor: Actor, classId: string) {
  if (actor.role !== "STUDENT" || !actor.studentId) throw new RequestError(403, "Chỉ tài khoản học sinh được nộp bài.");
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_classId: { studentId: actor.studentId, classId } }, select: { status: true },
  });
  if (!enrollment) throw new RequestError(404, "Không tìm thấy bài tập.");
  return enrollment;
}

/** Student view: only assignments of classes the student is (or was) enrolled in. */
export async function getAssignmentForStudent(db: PrismaClient, actor: Actor, assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { classGroup: { select: { id: true, name: true, code: true, teacherId: true } } },
  });
  if (!assignment) throw new RequestError(404, "Không tìm thấy bài tập.");
  const enrollment = await activeEnrollmentFor(db, actor, assignment.classId);
  const submissions = await db.submission.findMany({
    where: { assignmentId, studentId: actor.studentId! },
    include: { videoFile: { select: { id: true, originalName: true, sizeBytes: true } } },
    orderBy: { attempt: "desc" },
  });
  return { assignment, submissions, canSubmit: enrollment.status === "ACTIVE" && submissions[0]?.status !== "REVIEWED" };
}

export const submissionSchema = z.object({
  textAnswer: text(2000, "Ghi chú bài nộp"),
  videoFileId: z.string().trim().refine((value) => value === "" || z.uuid().safeParse(value).success, "Video không hợp lệ.").default(""),
});

export async function submitAssignment(db: PrismaClient, actor: Actor, assignmentId: string, raw: unknown) {
  const input = submissionSchema.parse(raw);
  const { assignment, submissions, canSubmit } = await getAssignmentForStudent(db, actor, assignmentId);
  if (!canSubmit) throw new RequestError(422, "Bài tập này đã được chấm xong hoặc bạn không còn học lớp này.");
  if (assignment.requireVideo && !input.videoFileId) throw new RequestError(422, "Bài tập này cần tải lên video.");
  if (!input.videoFileId && !input.textAnswer) throw new RequestError(422, "Vui lòng tải video hoặc nhập nội dung bài nộp.");
  if (input.videoFileId) {
    const file = await db.storedFile.findUnique({ where: { id: input.videoFileId }, include: { submission: { select: { id: true } } } });
    if (!file || file.ownerId !== actor.userId || file.submission) throw new RequestError(422, "Video không hợp lệ; vui lòng tải lên lại.");
  }
  const attempt = (submissions[0]?.attempt ?? 0) + 1;
  return db.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: {
        assignmentId, studentId: actor.studentId!, attempt, textAnswer: input.textAnswer,
        videoFileId: input.videoFileId || null,
      },
    });
    const student = await tx.student.findUniqueOrThrow({ where: { id: actor.studentId! }, select: { fullName: true } });
    await notify(tx, [await teacherUserId(tx, assignment.classGroup.teacherId)], {
      title: `${student.fullName} đã nộp bài “${assignment.title}”${attempt > 1 ? ` (lần ${attempt})` : ""}`,
      body: assignment.classGroup.name,
      href: `/giao-vien/bai-tap/${assignment.id}`,
    });
    await audit(tx, actor, "submission.created", "Submission", submission.id, { assignmentId, attempt });
    return submission;
  });
}

export async function getAssignmentForTeacher(db: PrismaClient, actor: Actor, assignmentId: string) {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { classGroup: { select: { id: true, name: true, code: true, teacherId: true } } },
  });
  if (!assignment) throw new RequestError(404, "Không tìm thấy bài tập.");
  await assertClassTeacherOrManager(db, actor, assignment.classId);
  const submissions = await db.submission.findMany({
    where: { assignmentId },
    include: {
      student: { select: { id: true, code: true, fullName: true } },
      videoFile: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } },
    },
    orderBy: [{ student: { fullName: "asc" } }, { attempt: "desc" }],
  });
  const roster = await db.enrollment.findMany({
    where: { classId: assignment.classId, status: "ACTIVE" },
    include: { student: { select: { id: true, code: true, fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return { assignment, submissions, roster: roster.map((item) => item.student) };
}

export const reviewSchema = z.object({
  status: z.enum(["REVIEWED", "NEEDS_REVISION"], "Chọn kết quả chấm."),
  score: z.string().trim().refine((value) => value === "" || /^(10|[0-9])$/.test(value), "Điểm từ 0 đến 10.").default(""),
  feedback: text(2000, "Nhận xét"),
});

export async function reviewSubmission(db: PrismaClient, actor: Actor, submissionId: string, raw: unknown) {
  const input = reviewSchema.parse(raw);
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { id: true, title: true, classId: true } }, student: { select: { userId: true } } },
  });
  if (!submission) throw new RequestError(404, "Không tìm thấy bài nộp.");
  await assertClassTeacherOrManager(db, actor, submission.assignment.classId);
  if (input.status === "NEEDS_REVISION" && !input.feedback) throw new RequestError(422, "Hãy ghi nhận xét để học sinh biết cần sửa gì.");
  const latest = await db.submission.findFirst({
    where: { assignmentId: submission.assignmentId, studentId: submission.studentId },
    orderBy: { attempt: "desc" }, select: { id: true },
  });
  if (latest?.id !== submission.id) throw new RequestError(409, "Học sinh đã nộp lại; vui lòng chấm bài mới nhất.");
  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: input.status, feedback: input.feedback, score: input.score === "" ? null : Number(input.score),
        reviewedAt: new Date(), reviewedById: actor.userId,
      },
    });
    await notify(tx, [submission.student.userId], {
      title: input.status === "NEEDS_REVISION" ? `Cần nộp lại: ${submission.assignment.title}` : `Đã chấm: ${submission.assignment.title}`,
      body: [input.score !== "" ? `Điểm ${input.score}/10` : "", input.feedback.slice(0, 200)].filter(Boolean).join(" · "),
      href: `/hoc-sinh/bai-tap/${submission.assignment.id}`,
    });
    await audit(tx, actor, "submission.reviewed", "Submission", submission.id, { status: input.status });
  });
}

/** Video access: uploader, staff/admin, or the main teacher of the class the video was submitted to. */
export async function getAccessibleFile(db: PrismaClient, actor: Actor, fileId: string) {
  const file = await db.storedFile.findUnique({
    where: { id: fileId },
    include: { submission: { select: { assignment: { select: { classGroup: { select: { teacherId: true } } } } } } },
  });
  if (!file) return null;
  if (file.ownerId === actor.userId || isManager(actor)) return file;
  if (actor.role === "TEACHER" && actor.teacherId && file.submission?.assignment.classGroup.teacherId === actor.teacherId) return file;
  return null;
}
