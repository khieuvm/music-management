import { toCsv } from "@/lib/csv";
import type { PrismaClient } from "@/generated/prisma/client";
import { priceLesson, summarizeTeaching } from "@/lib/payroll";
import { addDays, localDateTime, startOfLocalDay } from "@/lib/time";

/** Completed lessons in [from, to] local dates, grouped per teacher and priced with the configured pay rates. */
export async function teachingReport(db: PrismaClient, from: string, to: string, teacherId?: string) {
  const rates = await db.payRate.findMany(teacherId ? { where: { OR: [{ teacherId }, { teacherId: null }] } } : undefined);
  const lessons = await db.lesson.findMany({
    where: {
      status: "COMPLETED",
      startsAt: { gte: localDateTime(from, "00:00"), lt: localDateTime(addDays(to, 1), "00:00") },
      ...(teacherId ? { teacherId } : {}),
    },
    include: {
      teacher: { select: { id: true, fullName: true } },
      classGroup: { select: { code: true, name: true } },
      _count: { select: { attendance: { where: { status: { in: ["PRESENT", "LATE"] } } } } },
    },
    orderBy: [{ startsAt: "asc" }],
  });
  const priced = lessons.map((lesson) => ({ ...lesson, pay: priceLesson(lesson, rates) }));
  const groups = new Map<string, { teacher: { id: string; fullName: string }; lessons: typeof priced }>();
  for (const lesson of priced) {
    const group = groups.get(lesson.teacherId) ?? { teacher: lesson.teacher, lessons: [] };
    group.lessons.push(lesson);
    groups.set(lesson.teacherId, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, summary: summarizeTeaching(group.lessons, rates) }))
    .sort((a, b) => a.teacher.fullName.localeCompare(b.teacher.fullName, "vi"));
}

export function teachingCsv(report: Awaited<ReturnType<typeof teachingReport>>) {
  const header = ["Giáo viên", "Lớp", "Bắt đầu (ISO)", "Kết thúc (ISO)", "Số phút", "Phút buổi tối", "Phút cuối tuần", "Học sinh có mặt", "Tiền tạm tính (VND)"];
  const rows = report.flatMap((group) => group.lessons.map((lesson) => {
    const item = lesson.pay;
    return [group.teacher.fullName, lesson.classGroup.code, lesson.startsAt.toISOString(), lesson.endsAt.toISOString(),
      item.minutes, item.eveningMinutes, item.weekendMinutes, lesson._count.attendance, item.payVnd ?? "Chưa có đơn giá"];
  }));
  return toCsv(header, rows);
}

export async function managerDashboard(db: PrismaClient) {
  const todayStart = startOfLocalDay();
  const tomorrow = new Date(todayStart.getTime() + 86_400_000);
  const [students, classes, newConsultations, todayLessons, pendingAttendance] = await Promise.all([
    db.student.count({ where: { status: "ACTIVE" } }),
    db.classGroup.count({ where: { status: { in: ["PLANNED", "ACTIVE"] } } }),
    db.consultationRequest.count({ where: { status: "NEW" } }),
    db.lesson.findMany({
      where: { startsAt: { gte: todayStart, lt: tomorrow }, status: { not: "CANCELLED" } },
      include: { classGroup: { select: { code: true, name: true } }, teacher: { select: { fullName: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.lesson.count({ where: { status: "SCHEDULED", endsAt: { lt: new Date() } } }),
  ]);
  return { students, classes, newConsultations, todayLessons, pendingAttendance };
}
