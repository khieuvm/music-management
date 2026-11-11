import Link from "next/link";
import { sendFeeReminderAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { installmentStateLabels, installmentStateText, installmentStateTone } from "@/lib/fees";
import { formatVnd } from "@/lib/format";
import { firstParam } from "@/lib/page";
import { dueReport, dueViews, lastReminders, parseDueView, type DueView } from "@/lib/services/fees";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata = { title: "Công nợ học phí" };

const statCards = [
  { view: "qua-han", state: "OVERDUE", tone: "bad" },
  { view: "hom-nay", state: "DUE_TODAY", tone: "alert" },
  { view: "sap-den", state: "DUE_SOON", tone: "warn" },
  { view: "tat-ca", state: "UPCOMING", tone: "default" },
] as const;

export default async function OutstandingPage({ searchParams }: PageProps<"/quan-tri/hoc-phi">) {
  const params = await searchParams;
  const view = parseDueView(firstParam(params.loc));
  const classId = firstParam(params.lop);
  const q = firstParam(params.q);
  const db = getDb();
  const [{ summary, rows }, classes] = await Promise.all([
    dueReport(db, { view, classId, q }),
    db.classGroup.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const reminders = await lastReminders(db, [...new Set(rows.map(({ row }) => row.enrollment.id))]);
  const query = (next: Partial<{ loc: DueView }>) => {
    const search = new URLSearchParams({ loc: next.loc ?? view, ...(classId ? { lop: classId } : {}), ...(q ? { q } : {}) });
    return `?${search}`;
  };
  const seen = new Set<string>();
  const totalVnd = rows.reduce((sum, { item }) => sum + item.outstandingVnd, 0);
  return (
    <>
      <div className="page-head">
        <h1>Công nợ học phí</h1>
        <p className="muted">Mỗi dòng là một đợt đóng còn thiếu. Màu: <Badge tone="bad">quá hạn</Badge> <Badge tone="alert">đến hạn hôm nay</Badge> <Badge tone="warn">sắp đến hạn (≤ 7 ngày)</Badge> <Badge>chưa đến hạn</Badge></p>
      </div>
      <div className="stat-grid">
        {statCards.map((card) => (
          <Link key={card.view} href={query({ loc: card.view })} className={`stat tone-${card.tone}${view === card.view ? " is-active" : ""}`}>
            <strong>{formatVnd(summary[card.state].amountVnd)}</strong>
            <span>{card.view === "tat-ca" ? "Chưa đến hạn (xem tất cả)" : installmentStateLabels[card.state]} · {summary[card.state].students} học sinh</span>
          </Link>
        ))}
      </div>
      <form className="search-bar" role="search">
        <select name="loc" defaultValue={view} aria-label="Lọc theo tình trạng">
          {Object.entries(dueViews).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
        <select name="lop" defaultValue={classId} aria-label="Lớp">
          <option value="">Mọi lớp</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Tên, mã HS, phụ huynh, SĐT…" aria-label="Tìm" />
        <button className="button small" type="submit">Lọc</button>
        <a className="button small secondary" href={`/api/bao-cao/cong-no${query({})}`}>Xuất CSV</a>
      </form>
      <p><strong>{rows.length}</strong> đợt · tổng còn thiếu <strong>{formatVnd(totalVnd)}</strong> ({dueViews[view].label.toLowerCase()})</p>
      {!rows.length ? <Empty>Không có khoản nào trong mục này.</Empty> : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead><tr><th>Học sinh</th><th>Phụ huynh</th><th>Lớp</th><th>Đợt / hạn</th><th>Còn thiếu</th><th>Tình trạng</th><th>Thao tác</th></tr></thead>
            <tbody>
              {rows.map(({ row, item }) => {
                const student = row.enrollment.student;
                const reminded = reminders.get(row.enrollment.id);
                const firstOfEnrollment = !seen.has(row.enrollment.id);
                seen.add(row.enrollment.id);
                return (
                  <tr key={item.id} className={`fee-row ${item.state.toLowerCase()}`}>
                    <td data-label="Học sinh"><Link href={`/quan-tri/hoc-sinh/${student.id}`}>{student.fullName}</Link><br /><span className="muted">{student.code}</span></td>
                    <td data-label="Phụ huynh">{student.parentName || <span className="muted">—</span>}{student.parentPhone && <><br /><a className="tel" href={`tel:${student.parentPhone}`}>{student.parentPhone}</a></>}</td>
                    <td data-label="Lớp"><Link href={`/quan-tri/lop/${row.enrollment.classGroup.id}`}>{row.enrollment.classGroup.code}</Link>{row.enrollment.status !== "ACTIVE" && <><br /><span className="muted">đã rút</span></>}</td>
                    <td data-label="Đợt / hạn">Đợt {item.sequence}/{row.installments.length}<br />{formatDate(item.dueDate, true)}</td>
                    <td data-label="Còn thiếu"><strong>{formatVnd(item.outstandingVnd)}</strong>{item.partial && <><br /><span className="muted">đã trả {formatVnd(item.coveredVnd)}</span></>}</td>
                    <td data-label="Tình trạng"><Badge tone={installmentStateTone[item.state]}>{installmentStateText(item)}</Badge>{reminded && <><br /><span className="muted">Nhắc lần cuối {formatDateTime(reminded)}</span></>}</td>
                    <td data-label="Thao tác">
                      <div className="button-row">
                        <Link className="button small" href={`/quan-tri/hoc-sinh/${student.id}#ghi-danh-${row.enrollment.id}`}>Thu tiền</Link>
                        {firstOfEnrollment && item.state !== "UPCOMING" && (student.userId
                          ? <ActionForm action={sendFeeReminderAction} submitLabel="Gửi nhắc" className="mini-form"><input type="hidden" name="enrollmentId" value={row.enrollment.id} /></ActionForm>
                          : <span className="muted">Chưa có tài khoản — gọi điện</span>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
