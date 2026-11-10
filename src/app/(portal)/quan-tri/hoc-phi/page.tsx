import Link from "next/link";
import { Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { listOutstanding } from "@/lib/services/fees";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Công nợ học phí" };

export default async function OutstandingPage() {
  const rows = await listOutstanding(getDb());
  rows.sort((a, b) => b.overdueVnd - a.overdueVnd || (a.nextDue?.getTime() ?? 0) - (b.nextDue?.getTime() ?? 0));
  const total = rows.reduce((sum, row) => sum + row.outstandingVnd, 0);
  const overdue = rows.reduce((sum, row) => sum + row.overdueVnd, 0);
  return (
    <>
      <div className="page-head"><h1>Công nợ học phí</h1></div>
      <div className="stat-grid">
        <div className="stat"><strong>{formatVnd(total)}</strong><span>Còn phải thu</span></div>
        <div className="stat"><strong>{formatVnd(overdue)}</strong><span>Đã quá hạn</span></div>
      </div>
      {!rows.length ? <Empty>Không có khoản nào còn nợ.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Học sinh</th><th>Lớp</th><th>SĐT phụ huynh</th><th>Còn lại</th><th>Quá hạn</th><th>Hạn kế tiếp</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.enrollment.id} className={row.overdueVnd > 0 ? "warn-row" : undefined}>
                  <td><Link href={`/quan-tri/hoc-sinh/${row.enrollment.student.id}`}>{row.enrollment.student.fullName}</Link><br /><span className="muted">{row.enrollment.student.code}</span></td>
                  <td>{row.enrollment.classGroup.name}</td>
                  <td>{row.enrollment.student.parentPhone}</td>
                  <td>{formatVnd(row.outstandingVnd)}</td>
                  <td>{row.overdueVnd ? formatVnd(row.overdueVnd) : "—"}</td>
                  <td>{row.nextDue ? formatDate(row.nextDue, true) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
