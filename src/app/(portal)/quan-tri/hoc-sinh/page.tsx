import Link from "next/link";
import { createStudentAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { StudentFields } from "@/components/portal/person-forms";
import { getDb } from "@/lib/db";
import { installmentStateText, installmentStateTone } from "@/lib/fees";
import { formatVnd } from "@/lib/format";
import { studentStatusLabels } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { studentDirectory, studentFeeFilters } from "@/lib/services/people";

export const metadata = { title: "Học sinh & phụ huynh" };

export default async function StudentsPage({ searchParams }: PageProps<"/quan-tri/hoc-sinh">) {
  const params = await searchParams;
  const filter = { q: firstParam(params.q), status: firstParam(params.trang_thai), classId: firstParam(params.lop), fee: firstParam(params.hoc_phi) };
  const db = getDb();
  const [rows, classes] = await Promise.all([
    studentDirectory(db, filter),
    db.classGroup.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const exportQuery = new URLSearchParams(Object.entries({ q: filter.q, trang_thai: filter.status, lop: filter.classId, hoc_phi: filter.fee }).filter(([, value]) => value));
  return (
    <>
      <div className="page-head"><h1>Học sinh & phụ huynh</h1></div>
      <details className="panel">
        <summary><strong>+ Thêm học sinh mới</strong></summary>
        <p className="muted">Mã học sinh (HS0001…) được tạo tự động. Sau khi lưu, bạn có thể tạo tài khoản đăng nhập và ghi danh vào lớp.</p>
        <ActionForm action={createStudentAction} submitLabel="Lưu học sinh"><StudentFields /></ActionForm>
      </details>
      <form className="search-bar" role="search">
        <input name="q" defaultValue={filter.q} placeholder="Tên, mã HS, tên/SĐT/email phụ huynh…" aria-label="Tìm học sinh" />
        <select name="trang_thai" defaultValue={filter.status} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.entries(studentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="lop" defaultValue={filter.classId} aria-label="Lớp">
          <option value="">Mọi lớp</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select>
        <select name="hoc_phi" defaultValue={filter.fee} aria-label="Học phí">
          {Object.entries(studentFeeFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="button small" type="submit">Tìm</button>
        <a className="button small secondary" href={`/api/bao-cao/hoc-sinh${exportQuery.size ? `?${exportQuery}` : ""}`}>Xuất danh bạ CSV</a>
      </form>
      <p className="muted">{rows.length} học sinh{rows.length >= 500 ? " (hiển thị tối đa 500 — hãy lọc thêm)" : ""}.</p>
      {!rows.length ? <Empty>Không tìm thấy học sinh.</Empty> : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead><tr><th>Học sinh</th><th>Phụ huynh</th><th>Lớp đang học</th><th>Học phí</th><th>Tài khoản</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {rows.map(({ student, fee }) => (
                <tr key={student.id} className={fee.urgent && fee.urgent.state !== "UPCOMING" ? `fee-row ${fee.urgent.state.toLowerCase()}` : undefined}>
                  <td data-label="Học sinh"><Link href={`/quan-tri/hoc-sinh/${student.id}`}>{student.fullName}</Link><br /><span className="muted">{student.code}</span></td>
                  <td data-label="Phụ huynh">
                    {student.parentName || <span className="muted">—</span>}
                    {student.parentPhone && <><br /><a className="tel" href={`tel:${student.parentPhone}`}>{student.parentPhone}</a></>}
                    {student.parentEmail && <><br /><span className="muted">{student.parentEmail}</span></>}
                  </td>
                  <td data-label="Lớp đang học">
                    {!student.enrollments.length ? <span className="muted">—</span> : student.enrollments.map((item, index) => (
                      <span key={item.classGroup.id}>{index > 0 && ", "}<Link href={`/quan-tri/lop/${item.classGroup.id}`}>{item.classGroup.code}</Link></span>
                    ))}
                  </td>
                  <td data-label="Học phí">
                    {fee.urgent
                      ? <><Badge tone={installmentStateTone[fee.urgent.state]}>{installmentStateText(fee.urgent)}</Badge><br /><span className="muted">còn {formatVnd(fee.outstandingVnd)}</span></>
                      : fee.outstandingVnd === 0 && student.enrollments.length ? <Badge tone="good">Đã đóng đủ</Badge> : <span className="muted">—</span>}
                  </td>
                  <td data-label="Tài khoản">{student.user ? student.user.username : <span className="muted">Chưa có</span>}</td>
                  <td data-label="Trạng thái"><Badge tone={student.status === "ACTIVE" ? "good" : student.status === "PAUSED" ? "warn" : "default"}>{studentStatusLabels[student.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
