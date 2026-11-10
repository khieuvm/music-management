import { Empty } from "@/components/fields";
import { AbsenceList, absenceListInclude } from "@/components/portal/absence-list";
import { LessonTable } from "@/components/portal/lesson-table";
import { getDb } from "@/lib/db";
import { teacherEditDeadline } from "@/lib/services/attendance";
import { requireTeacher } from "@/lib/teacher";
import { addDays, formatDateTime, localDateKey, startOfLocalDay } from "@/lib/time";

export const metadata = { title: "Lịch dạy" };

export default async function TeacherHome() {
  const { actor, teacherId } = await requireTeacher();
  const db = getDb();
  const now = new Date();
  const include = { classGroup: { select: { code: true, name: true, location: true, meetingUrl: true } } };
  const [pending, upcoming, toReview, absences] = await Promise.all([
    db.lesson.findMany({
      where: { teacherId, status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gte: new Date(now.getTime() - 48 * 3_600_000) } },
      include, orderBy: { startsAt: "asc" },
    }),
    db.lesson.findMany({
      where: { teacherId, status: { not: "CANCELLED" }, startsAt: { gte: startOfLocalDay(), lt: startOfLocalDay(addDays(localDateKey(now), 14)) } },
      include, orderBy: { startsAt: "asc" },
    }),
    db.submission.count({ where: { status: "SUBMITTED", assignment: { classGroup: { teacherId } } } }),
    db.absenceRequest.findMany({
      where: { status: { not: "CANCELLED" }, lesson: { teacherId, status: "SCHEDULED", startsAt: { gte: startOfLocalDay() } } },
      include: absenceListInclude, orderBy: { lesson: { startsAt: "asc" } }, take: 30,
    }),
  ]);
  const late = await db.lesson.count({ where: { teacherId, status: "SCHEDULED", endsAt: { lt: new Date(now.getTime() - 48 * 3_600_000) } } });
  return (
    <>
      <div className="page-head"><h1>Chào {actor.displayName}</h1></div>
      {toReview > 0 && <p className="status">Có {toReview} bài nộp đang chờ chấm — xem ở mục “Lớp & bài tập”.</p>}
      {late > 0 && <p className="status error">{late} buổi đã quá hạn điểm danh (48 giờ). Vui lòng báo giáo vụ để được xác nhận giờ dạy.</p>}
      <section className="panel">
        <h2>Cần điểm danh</h2>
        {!pending.length ? <Empty>Không có buổi nào chờ điểm danh.</Empty> : (
          <>
            <LessonTable lessons={pending} hrefFor={(id) => `/giao-vien/buoi/${id}`} />
            <p className="muted">Hạn chót: 48 giờ sau khi buổi kết thúc (ví dụ buổi đầu tiên: {formatDateTime(teacherEditDeadline(pending[0]))}).</p>
          </>
        )}
      </section>
      <section className="panel">
        <h2>Đơn xin nghỉ</h2>
        <AbsenceList items={absences} hrefFor={(id) => `/giao-vien/buoi/${id}`} />
      </section>
      <section className="panel">
        <h2>Lịch dạy 14 ngày tới</h2>
        <LessonTable lessons={upcoming} hrefFor={(id) => `/giao-vien/buoi/${id}`} empty="Không có buổi dạy nào." />
      </section>
    </>
  );
}
