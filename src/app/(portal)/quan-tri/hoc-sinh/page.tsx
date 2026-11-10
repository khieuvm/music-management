import Link from "next/link";
import { createStudentAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { StudentFields } from "@/components/portal/person-forms";
import { getDb } from "@/lib/db";
import { studentStatusLabels } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { searchStudents } from "@/lib/services/people";

export const metadata = { title: "Học sinh" };

export default async function StudentsPage({ searchParams }: PageProps<"/quan-tri/hoc-sinh">) {
  const params = await searchParams;
  const query = firstParam(params.q);
  const status = firstParam(params.trang_thai);
  const students = await searchStudents(getDb(), query, status);
  return (
    <>
      <div className="page-head"><h1>Học sinh</h1></div>
      <details className="panel">
        <summary><strong>+ Thêm học sinh mới</strong></summary>
        <p className="muted">Mã học sinh (HS0001…) được tạo tự động. Sau khi lưu, bạn có thể tạo tài khoản đăng nhập và ghi danh vào lớp.</p>
        <ActionForm action={createStudentAction} submitLabel="Lưu học sinh"><StudentFields /></ActionForm>
      </details>
      <form className="search-bar" role="search">
        <input name="q" defaultValue={query} placeholder="Tìm tên, mã HS, SĐT phụ huynh…" aria-label="Tìm học sinh" />
        <select name="trang_thai" defaultValue={status} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.entries(studentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="button small" type="submit">Tìm</button>
      </form>
      {!students.length ? <Empty>Không tìm thấy học sinh.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mã</th><th>Họ tên</th><th>Phụ huynh</th><th>Lớp đang học</th><th>Tài khoản</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.code}</td>
                  <td><Link href={`/quan-tri/hoc-sinh/${student.id}`}>{student.fullName}</Link></td>
                  <td>{student.parentName}{student.parentPhone && <><br /><span className="muted">{student.parentPhone}</span></>}</td>
                  <td>{student._count.enrollments}</td>
                  <td>{student.user ? student.user.username : <span className="muted">Chưa có</span>}</td>
                  <td><Badge tone={student.status === "ACTIVE" ? "good" : "default"}>{studentStatusLabels[student.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
