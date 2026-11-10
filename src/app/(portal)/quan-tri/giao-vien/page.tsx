import Link from "next/link";
import { createTeacherAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { TeacherFields } from "@/components/portal/person-forms";
import { getDb } from "@/lib/db";
import { teacherStatusLabels } from "@/lib/labels";

export const metadata = { title: "Giáo viên" };

export default async function TeachersPage() {
  const teachers = await getDb().teacher.findMany({
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    include: { user: { select: { username: true } }, _count: { select: { classes: { where: { status: { in: ["PLANNED", "ACTIVE"] } } } } } },
  });
  return (
    <>
      <div className="page-head"><h1>Giáo viên</h1></div>
      <details className="panel">
        <summary><strong>+ Thêm giáo viên</strong></summary>
        <ActionForm action={createTeacherAction} submitLabel="Lưu giáo viên"><TeacherFields /></ActionForm>
      </details>
      {!teachers.length ? <Empty>Chưa có giáo viên.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Họ tên</th><th>Môn dạy</th><th>Liên hệ</th><th>Lớp phụ trách</th><th>Tài khoản</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td><Link href={`/quan-tri/giao-vien/${teacher.id}`}>{teacher.fullName}</Link></td>
                  <td>{teacher.subjects}</td>
                  <td>{teacher.phone}</td>
                  <td>{teacher._count.classes}</td>
                  <td>{teacher.user?.username ?? <span className="muted">Chưa có</span>}</td>
                  <td><Badge tone={teacher.status === "ACTIVE" ? "good" : "default"}>{teacherStatusLabels[teacher.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
