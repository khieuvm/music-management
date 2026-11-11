import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { classFlags, emptyProgress, type ClassProgress } from "@/lib/class-status";
import { audit } from "@/lib/services/audit";
import { feeLedger } from "@/lib/services/fees";

type ProgressRow = {
  classId: string; total: bigint; completed: bigint; pending: bigint; upcoming: bigint;
  next_at: Date | null; first_at: Date | null; last_at: Date | null;
};
type AttendanceRow = { classId: string; marks: bigint; present: bigint };

/** Lesson and attendance progress per class, computed in two aggregate queries. */
export async function classProgress(db: PrismaClient, classIds: string[]) {
  const result = new Map<string, ClassProgress>();
  if (!classIds.length) return result;
  const [lessons, attendance] = await Promise.all([
    db.$queryRaw<ProgressRow[]>`
      SELECT "classId",
        COUNT(*) FILTER (WHERE "status" <> 'CANCELLED') AS total,
        COUNT(*) FILTER (WHERE "status" = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE "status" = 'SCHEDULED' AND "endsAt" < now()) AS pending,
        COUNT(*) FILTER (WHERE "status" = 'SCHEDULED' AND "startsAt" > now()) AS upcoming,
        MIN("startsAt") FILTER (WHERE "status" = 'SCHEDULED' AND "startsAt" > now()) AS next_at,
        MIN("startsAt") FILTER (WHERE "status" <> 'CANCELLED') AS first_at,
        MAX("endsAt") FILTER (WHERE "status" <> 'CANCELLED') AS last_at
      FROM "Lesson" WHERE "classId" = ANY(${classIds}::uuid[]) GROUP BY "classId"`,
    db.$queryRaw<AttendanceRow[]>`
      SELECT l."classId", COUNT(*) AS marks, COUNT(*) FILTER (WHERE a."status" IN ('PRESENT', 'LATE')) AS present
      FROM "Attendance" a JOIN "Lesson" l ON l."id" = a."lessonId"
      WHERE l."classId" = ANY(${classIds}::uuid[]) AND l."status" = 'COMPLETED' GROUP BY l."classId"`,
  ]);
  for (const row of lessons) {
    result.set(row.classId, {
      ...emptyProgress,
      totalLessons: Number(row.total), completedLessons: Number(row.completed), pendingAttendance: Number(row.pending),
      upcomingLessons: Number(row.upcoming), nextLessonAt: row.next_at, firstLessonAt: row.first_at, lastLessonEndsAt: row.last_at,
    });
  }
  for (const row of attendance) {
    const current = result.get(row.classId) ?? { ...emptyProgress };
    result.set(row.classId, { ...current, attendanceMarks: Number(row.marks), presentMarks: Number(row.present) });
  }
  return result;
}

/** Per-student attendance in one class: marks counted on completed lessons only. */
export async function studentAttendanceInClass(db: PrismaClient, classId: string) {
  const rows = await db.$queryRaw<{ studentId: string; marks: bigint; present: bigint; absent: bigint }[]>`
    SELECT a."studentId", COUNT(*) AS marks,
      COUNT(*) FILTER (WHERE a."status" IN ('PRESENT', 'LATE')) AS present,
      COUNT(*) FILTER (WHERE a."status" = 'ABSENT') AS absent
    FROM "Attendance" a JOIN "Lesson" l ON l."id" = a."lessonId"
    WHERE l."classId" = ${classId}::uuid AND l."status" = 'COMPLETED' GROUP BY a."studentId"`;
  return new Map(rows.map((row) => [row.studentId, { marks: Number(row.marks), present: Number(row.present), absent: Number(row.absent) }]));
}

/**
 * Moves PLANNED classes to ACTIVE once their first non-cancelled lesson has started. Idempotent and cheap, so
 * pages that show class status call it before reading instead of relying on a scheduler.
 */
export async function syncClassStatuses(db: PrismaClient, now = new Date()) {
  const due = await db.classGroup.findMany({
    where: { status: "PLANNED", lessons: { some: { status: { not: "CANCELLED" }, startsAt: { lte: now } } } },
    select: { id: true, code: true },
  });
  for (const item of due) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.classGroup.updateMany({ where: { id: item.id, status: "PLANNED" }, data: { status: "ACTIVE" } });
      if (count) await audit(tx, null, "class.auto_started", "ClassGroup", item.id, { code: item.code });
    });
  }
  return due.length;
}

/** Classes with progress, overdue fees and attention flags; used by the class list and the dashboard. */
export async function classBoard(db: PrismaClient, where: Prisma.ClassGroupWhereInput) {
  const classes = await db.classGroup.findMany({
    where,
    include: {
      course: { select: { title: true } }, teacher: { select: { fullName: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  const ids = classes.map((item) => item.id);
  const [progressMap, ledger] = await Promise.all([
    classProgress(db, ids),
    ids.length ? feeLedger(db, {}) : Promise.resolve([]),
  ]);
  const overdueByClass = new Map<string, number>();
  for (const row of ledger) overdueByClass.set(row.enrollment.classId, (overdueByClass.get(row.enrollment.classId) ?? 0) + row.overdueVnd);
  return classes.map((item) => {
    const progress = progressMap.get(item.id) ?? emptyProgress;
    const overdueVnd = overdueByClass.get(item.id) ?? 0;
    const flags = classFlags({ status: item.status, capacity: item.capacity, students: item._count.enrollments, progress, overdueVnd });
    return { item, progress, overdueVnd, flags, needsAttention: flags.some((flag) => flag.tone !== "default") };
  });
}
