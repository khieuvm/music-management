import Link from "next/link";
import { AbsenceList, absenceListInclude } from "@/components/portal/absence-list";
import { LessonTable } from "@/components/portal/lesson-table";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { Badge, Empty } from "@/components/fields";
import { FlagList, ProgressMeter } from "@/components/portal/class-overview";
import { formatVnd } from "@/lib/format";
import { classStatusLabels, classStatusTone } from "@/lib/labels";
import { classBoard, syncClassStatuses } from "@/lib/services/class-progress";
import { listDueInstallments, summarizeDue } from "@/lib/services/fees";
import { managerDashboard } from "@/lib/services/reports";
import { addDays, localDateKey, startOfLocalDay } from "@/lib/time";

export const metadata = { title: "Tổng quan" };

export default async function ManagerHome() {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const db = getDb();
  await syncClassStatuses(db);
  const [data, absences, due, board] = await Promise.all([
    managerDashboard(db),
    db.absenceRequest.findMany({
      where: {
        status: { not: "CANCELLED" },
        lesson: { status: "SCHEDULED", startsAt: { gte: startOfLocalDay(), lt: startOfLocalDay(addDays(localDateKey(new Date()), 7)) } },
      },
      include: absenceListInclude, orderBy: { lesson: { startsAt: "asc" } }, take: 50,
    }),
    listDueInstallments(db),
    classBoard(db, { status: { in: ["PLANNED", "ACTIVE"] } }),
  ]);
  const fees = summarizeDue(due);
  const attention = board.filter((row) => row.needsAttention);
  return (
    <>
      <div className="page-head"><h1>Xin chào, {actor.displayName}</h1></div>
      <div className="stat-grid">
        <Link className="stat" href="/quan-tri/hoc-sinh"><strong>{data.students}</strong><span>Học sinh đang học</span></Link>
        <Link className="stat" href="/quan-tri/lop"><strong>{data.classes}</strong><span>Lớp sắp mở / đang học</span></Link>
        <Link className="stat" href="/quan-tri/tu-van"><strong>{data.newConsultations}</strong><span>Yêu cầu tư vấn mới</span></Link>
        <div className={`stat${data.pendingAttendance ? " tone-bad" : ""}`}><strong>{data.pendingAttendance}</strong><span>Buổi đã qua chưa điểm danh</span></div>
      </div>
      <section className="panel">
        <div className="row-between"><h2>Học phí cần thu</h2><Link href="/quan-tri/hoc-phi">Mở trang công nợ →</Link></div>
        <div className="stat-grid compact">
          <Link className="stat tone-bad" href="/quan-tri/hoc-phi?loc=qua-han"><strong>{formatVnd(fees.OVERDUE.amountVnd)}</strong><span>Quá hạn · {fees.OVERDUE.students} học sinh</span></Link>
          <Link className="stat tone-alert" href="/quan-tri/hoc-phi?loc=hom-nay"><strong>{formatVnd(fees.DUE_TODAY.amountVnd)}</strong><span>Đến hạn hôm nay · {fees.DUE_TODAY.students} học sinh</span></Link>
          <Link className="stat tone-warn" href="/quan-tri/hoc-phi?loc=sap-den"><strong>{formatVnd(fees.DUE_SOON.amountVnd)}</strong><span>Sắp đến hạn (7 ngày) · {fees.DUE_SOON.students} học sinh</span></Link>
        </div>
      </section>
      <section className="panel">
        <div className="row-between"><h2>Lớp cần xử lý ({attention.length})</h2><Link href="/quan-tri/lop?can_xu_ly=1">Xem tất cả lớp →</Link></div>
        {!attention.length ? <Empty>Các lớp đang ổn.</Empty> : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead><tr><th>Lớp</th><th>Tiến độ</th><th>Cần làm</th></tr></thead>
              <tbody>
                {attention.slice(0, 10).map(({ item, progress, flags }) => (
                  <tr key={item.id}>
                    <td data-label="Lớp"><Link href={`/quan-tri/lop/${item.id}`}>{item.name}</Link> <Badge tone={classStatusTone[item.status]}>{classStatusLabels[item.status]}</Badge><br /><span className="muted">{item.code} · GV {item.teacher.fullName}</span></td>
                    <td data-label="Tiến độ"><ProgressMeter progress={progress} /></td>
                    <td data-label="Cần làm"><FlagList flags={flags.filter((flag) => flag.tone !== "default")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
