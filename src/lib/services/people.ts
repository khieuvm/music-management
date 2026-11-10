import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { dateOnly } from "@/lib/time";
import { audit } from "@/lib/services/audit";
import { email, optionalDate, phone, requiredText, text } from "@/lib/validation";

export const studentSchema = z.object({
  fullName: requiredText(100, "Họ tên học sinh", 2),
  dateOfBirth: optionalDate("Ngày sinh"),
  parentName: text(100, "Tên phụ huynh"),
  parentPhone: phone,
  parentEmail: email,
  status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).default("ACTIVE"),
  note: text(1000, "Ghi chú"),
});
export type StudentInput = z.input<typeof studentSchema>;

function studentData(input: z.output<typeof studentSchema>) {
  return { ...input, dateOfBirth: input.dateOfBirth ? dateOnly(input.dateOfBirth) : null };
}

export async function createStudent(db: PrismaClient, actor: Actor, raw: unknown) {
  assertManager(actor);
  const input = studentSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('student-code'))`;
    const [row] = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST(SUBSTRING("code" FROM 3) AS INTEGER)) AS max FROM "Student" WHERE "code" ~ '^HS[0-9]+$'
    `;
    const code = `HS${String((row?.max ?? 0) + 1).padStart(4, "0")}`;
    const student = await tx.student.create({ data: { ...studentData(input), code } });
    await audit(tx, actor, "student.created", "Student", student.id, { code });
    return student;
  });
}

export async function updateStudent(db: PrismaClient, actor: Actor, studentId: string, raw: unknown) {
  assertManager(actor);
  const input = studentSchema.parse(raw);
  await db.$transaction(async (tx) => {
    const student = await tx.student.update({ where: { id: studentId }, data: studentData(input) });
    if (student.userId) {
      await tx.user.update({ where: { id: student.userId }, data: { displayName: student.fullName } });
    }
    await audit(tx, actor, "student.updated", "Student", student.id, { status: input.status });
  });
}

export function searchStudents(db: PrismaClient, query: string, status?: string) {
  const term = query.trim().slice(0, 100);
  return db.student.findMany({
    where: {
      ...(status && ["ACTIVE", "PAUSED", "STOPPED"].includes(status) ? { status: status as "ACTIVE" } : {}),
      ...(term ? {
        OR: [
          { fullName: { contains: term, mode: "insensitive" as const } },
          { code: { contains: term, mode: "insensitive" as const } },
          { parentPhone: { contains: term } },
          { parentName: { contains: term, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: { user: { select: { username: true, isActive: true } }, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
}

export const teacherSchema = z.object({
  fullName: requiredText(100, "Họ tên giáo viên", 2),
  phone,
  email,
  subjects: text(200, "Môn dạy"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  note: text(1000, "Ghi chú"),
});
export type TeacherInput = z.input<typeof teacherSchema>;

export async function createTeacher(db: PrismaClient, actor: Actor, raw: unknown) {
  assertManager(actor);
  const input = teacherSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const teacher = await tx.teacher.create({ data: input });
    await audit(tx, actor, "teacher.created", "Teacher", teacher.id);
    return teacher;
  });
}

export async function updateTeacher(db: PrismaClient, actor: Actor, teacherId: string, raw: unknown) {
  assertManager(actor);
  const input = teacherSchema.parse(raw);
  await db.$transaction(async (tx) => {
    if (input.status === "INACTIVE") {
      const upcoming = await tx.lesson.count({
        where: { teacherId, status: "SCHEDULED", startsAt: { gt: new Date() } },
      });
      if (upcoming) {
        throw new RequestError(422, `Giáo viên còn ${upcoming} buổi dạy sắp tới. Hãy chuyển buổi cho giáo viên khác trước.`);
      }
    }
    const teacher = await tx.teacher.update({ where: { id: teacherId }, data: input });
    if (teacher.userId) await tx.user.update({ where: { id: teacher.userId }, data: { displayName: teacher.fullName } });
    await audit(tx, actor, "teacher.updated", "Teacher", teacher.id, { status: input.status });
  });
}
