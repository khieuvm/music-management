import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { assertManager, type Actor } from "@/lib/access";
import { RequestError } from "@/lib/http";
import { toCsv } from "@/lib/csv";
import { stateUrgency } from "@/lib/fees";
import { studentStatusLabels } from "@/lib/labels";
import { dateOnly, dateOnlyKey } from "@/lib/time";
import { feeLedger, type LedgerRow } from "@/lib/services/fees";
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
    if (input.status === "STOPPED") {
      const active = await tx.enrollment.count({ where: { studentId, status: "ACTIVE" } });
      if (active) throw new RequestError(422, `Học sinh đang học ${active} lớp. Hãy rút khỏi lớp trước khi chuyển sang “Đã nghỉ”, hoặc chọn “Bảo lưu”.`);
    }
    const student = await tx.student.update({ where: { id: studentId }, data: studentData(input) });
    if (student.userId) {
      await tx.user.update({ where: { id: student.userId }, data: { displayName: student.fullName } });
    }
    await audit(tx, actor, "student.updated", "Student", student.id, { status: input.status });
  });
}

export type StudentFilter = { q?: string; status?: string; classId?: string; fee?: string };

export const studentFeeFilters = {
  "": "Mọi tình trạng học phí",
  "qua-han": "Có khoản quá hạn",
  "can-thu": "Quá hạn / đến hạn / sắp đến hạn",
  "con-no": "Còn nợ (mọi hạn)",
  "du": "Đã đóng đủ",
} as const;

/** Student + parent directory with current classes and worst fee state; shared by the page and its CSV export. */
export async function studentDirectory(db: PrismaClient, filter: StudentFilter) {
  const term = (filter.q ?? "").trim().slice(0, 100);
  const status = filter.status && ["ACTIVE", "PAUSED", "STOPPED"].includes(filter.status) ? filter.status as "ACTIVE" | "PAUSED" | "STOPPED" : undefined;
  const classId = filter.classId && /^[0-9a-f-]{36}$/i.test(filter.classId) ? filter.classId : undefined;
  const students = await db.student.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(classId ? { enrollments: { some: { classId, status: "ACTIVE" } } } : {}),
      ...(term ? {
        OR: [
          { fullName: { contains: term, mode: "insensitive" as const } },
          { code: { contains: term, mode: "insensitive" as const } },
          { parentPhone: { contains: term } },
          { parentName: { contains: term, mode: "insensitive" as const } },
          { parentEmail: { contains: term, mode: "insensitive" as const } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: {
      user: { select: { username: true, isActive: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { classGroup: { select: { id: true, code: true, name: true } } } },
    },
  });
  const ledger = await feeLedger(db, { studentIds: students.map((student) => student.id) });
  const fees = new Map<string, { outstandingVnd: number; overdueVnd: number; urgent: LedgerRow["nextDue"] }>();
  for (const row of ledger) {
    const current = fees.get(row.enrollment.studentId) ?? { outstandingVnd: 0, overdueVnd: 0, urgent: null };
    current.outstandingVnd += row.outstandingVnd;
    current.overdueVnd += row.overdueVnd;
    if (row.nextDue && (!current.urgent || stateUrgency[row.nextDue.state] < stateUrgency[current.urgent.state]
      || (row.nextDue.state === current.urgent.state && row.nextDue.dueDate < current.urgent.dueDate))) current.urgent = row.nextDue;
    fees.set(row.enrollment.studentId, current);
  }
  const rows = students.map((student) => ({ student, fee: fees.get(student.id) ?? { outstandingVnd: 0, overdueVnd: 0, urgent: null } }));
  const urgentStates = ["OVERDUE", "DUE_TODAY", "DUE_SOON"];
  return rows.filter(({ fee }) => {
    switch (filter.fee) {
      case "qua-han": return fee.overdueVnd > 0;
      case "can-thu": return !!fee.urgent && urgentStates.includes(fee.urgent.state);
      case "con-no": return fee.outstandingVnd > 0;
      case "du": return fee.outstandingVnd === 0;
      default: return true;
    }
  });
}

export function studentDirectoryCsv(rows: Awaited<ReturnType<typeof studentDirectory>>) {
  return toCsv(
    ["Mã HS", "Học sinh", "Ngày sinh", "Phụ huynh", "SĐT phụ huynh", "Email phụ huynh", "Lớp đang học", "Còn nợ (VND)", "Quá hạn (VND)", "Trạng thái", "Tài khoản"],
    rows.map(({ student, fee }) => [
      student.code, student.fullName, student.dateOfBirth ? dateOnlyKey(student.dateOfBirth) : "", student.parentName, student.parentPhone, student.parentEmail,
      student.enrollments.map((item) => item.classGroup.code).join("; "), fee.outstandingVnd, fee.overdueVnd,
      studentStatusLabels[student.status], student.user?.username ?? "",
    ]),
  );
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
