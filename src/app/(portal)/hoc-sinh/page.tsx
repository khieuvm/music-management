import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { LessonTable } from "@/components/portal/lesson-table";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { submissionStatusLabels, submissionTone } from "@/lib/labels";
import { getEnrollmentFinance } from "@/lib/services/fees";
import { requireStudent } from "@/lib/student";
import { studentLessons } from "@/lib/student-data";
import { addDays, formatDateTime, localDateKey, startOfLocalDay } from "@/lib/time";

export const metadata = { title: "Tổng quan" };

export default async function StudentHome() {
  const { actor, studentId } = await requireStudent();
  const db = getDb();
  const now = new Date();
  const [lessons, enrollments, recentFeedback, notes] = await Promise.all([
    studentLessons(db, studentId, { from: startOfLocalDay(), to: startOfLocalDay(addDays(localDateKey(now), 8)) }),
    db.enrollment.findMany({ where: { studentId, status: "ACTIVE" }, select: { id: true, classId: true } }),
    db.submission.findMany({
      where: { studentId, status: { in: ["REVIEWED", "NEEDS_REVISION"] } },
      include: { assignment: { select: { id: true, title: true } } },
      orderBy: { reviewedAt: "desc" }, take: 3,
    }),
    db.studentNote.findMany({
      where: { studentId, shared: true },
      include: { classGroup: { select: { name: true } }, author: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
  ]);
  const assignments = await db.assignment.findMany({
    where: { classId: { in: enrollments.map((item) => item.classId) }, NOT: { submissions: { some: { studentId, status: { in: ["SUBMITTED", "REVIEWED"] } } } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }], take: 10,
  });
  const finances = await Promise.all(enrollments.map((item) => getEnrollmentFinance(db, item.id)));
  const outstanding = finances.reduce((sum, item) => sum + (item?.outstandingVnd ?? 0), 0);
  const overdue = finances.some((item) => item?.installments.some((row) => row.state === "OVERDUE"));
  return (
    <>
      <div className="page-head"><h1>Xin chào, {actor.displayName}</h1></div>
      {overdue && <p className="status error">Có khoản học phí đã quá hạn. <Link href="/hoc-sinh/hoc-phi">Xem chi tiết</Link></p>}
      <section className="panel">
        <h2>Bài tập cần làm</h2>
        {!assignments.length ? <Empty>Không có bài tập nào đang chờ. 🎉</Empty> : (
          <ul className="plain-list">
            {assignments.map((item) => (
              <li key={item.id}>
                <Link href={`/hoc-sinh/bai-tap/${item.id}`}>{item.title}</Link>
                {item.dueAt && <span className={item.dueAt < now ? "error-text" : "muted"}> · hạn {formatDateTime(item.dueAt)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Lịch học 7 ngày tới</h2>
        <LessonTable lessons={lessons} empty="Không có buổi học nào trong 7 ngày tới." />
      </section>
      {notes.length > 0 && (
        <section className="panel">
          <h2>Nhận xét của giáo viên</h2>
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="note-meta">{formatDateTime(note.createdAt)} · {note.classGroup.name} · {note.author.displayName}</p>
                <p className="pre-line">{note.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {recentFeedback.length > 0 && (
        <section className="panel">
          <h2>Kết quả chấm bài gần đây</h2>
          <ul className="plain-list">
            {recentFeedback.map((item) => (
              <li key={item.id}>
                <Link href={`/hoc-sinh/bai-tap/${item.assignment.id}`}>{item.assignment.title}</Link>{" "}
                <Badge tone={submissionTone[item.status]}>{submissionStatusLabels[item.status]}</Badge>
                {item.score !== null && <> · {item.score}/10</>}
                {item.feedback && <><br /><span className="muted">{item.feedback}</span></>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {outstanding > 0 && <p className="muted">Học phí còn lại: {formatVnd(outstanding)} — <Link href="/hoc-sinh/hoc-phi">xem lịch đóng</Link>.</p>}
    </>
  );
}
