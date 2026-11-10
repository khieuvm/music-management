import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { lessonRosterWhere } from "@/lib/services/classes";

/** Lessons the student belongs to: within their enrollment window for each class. */
export async function studentLessons(db: PrismaClient, studentId: string, where: { from?: Date; to?: Date; order?: "asc" | "desc"; take?: number }) {
  const enrollments = await db.enrollment.findMany({ where: { studentId }, select: { classId: true, enrolledAt: true, withdrawnAt: true } });
  if (!enrollments.length) return [];
  const lessons = await db.lesson.findMany({
    where: {
      classId: { in: enrollments.map((item) => item.classId) },
      startsAt: { ...(where.from ? { gte: where.from } : {}), ...(where.to ? { lt: where.to } : {}) },
    },
    include: {
      classGroup: { select: { code: true, name: true, location: true, meetingUrl: true } },
      teacher: { select: { fullName: true } },
      attendance: { where: { studentId } },
      absences: { where: { studentId, status: { not: "CANCELLED" } } },
    },
    orderBy: { startsAt: where.order ?? "asc" },
    take: where.take ?? 200,
  });
  return lessons.filter((lesson) => enrollments.some((item) => item.classId === lesson.classId
    && item.enrolledAt <= lesson.endsAt && (!item.withdrawnAt || item.withdrawnAt > lesson.startsAt)));
}

export { lessonRosterWhere };
