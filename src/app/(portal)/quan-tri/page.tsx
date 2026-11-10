import Link from "next/link";
import { AbsenceList, absenceListInclude } from "@/components/portal/absence-list";
import { LessonTable } from "@/components/portal/lesson-table";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { managerDashboard } from "@/lib/services/reports";
import { addDays, localDateKey, startOfLocalDay } from "@/lib/time";

export const metadata = { title: "Tổng quan" };

export default async function ManagerHome() {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const db = getDb();
  const [data, absences] = await Promise.all([
    managerDashboard(db),
    db.absenceRequest.findMany({
      where: {
        status: { not: "CANCELLED" },
        lesson: { status: "SCHEDULED", startsAt: { gte: startOfLocalDay(), lt: startOfLocalDay(addDays(localDateKey(new Date()), 7)) } },
      },
      include: absenceListInclude, orderBy: { lesson: { startsAt: "asc" } }, take: 50,
    }),
  ]);
  return (
    <>
      <div className="page-head"><h1>Xin chào, {actor.displayName}</h1></div>
      <div className="stat-grid">
        <Link className="stat" href="/quan-tri/hoc-sinh"><strong>{data.students}</strong><span>Học sinh đang học</span></Link>
        <Link className="stat" href="/quan-tri/lop"><strong>{data.classes}</strong><span>Lớp sắp mở / đang học</span></Link>
        <Link className="stat" href="/quan-tri/tu-van"><strong>{data.newConsultations}</strong><span>Yêu cầu tư vấn mới</span></Link>
        <div className="stat"><strong>{data.pendingAttendance}</strong><span>Buổi đã qua chưa điểm danh</span></div>
      </div>
      <section className="panel">
        <h2>Lịch hôm nay</h2>
        <LessonTable lessons={data.todayLessons} hrefFor={(id) => `/quan-tri/buoi/${id}`} empty="Hôm nay không có buổi học." />
      </section>
      <section className="panel">
        <h2>Đơn xin nghỉ 7 ngày tới</h2>
        <AbsenceList items={absences} hrefFor={(id) => `/quan-tri/buoi/${id}`} />
      </section>
    </>
  );
}
