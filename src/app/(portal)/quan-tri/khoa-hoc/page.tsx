import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { categoryLabels } from "@/lib/format";
import { publicationLabels } from "@/lib/labels";

export const metadata = { title: "Khóa học" };

export default async function CoursesAdminPage() {
  const courses = await getDb().course.findMany({
    orderBy: [{ category: "asc" }, { title: "asc" }],
    include: { _count: { select: { classes: true, offerings: true } } },
  });
  return (
    <>
      <div className="page-head row-between">
        <h1>Khóa học</h1>
        <Link className="button small" href="/quan-tri/khoa-hoc/moi">+ Khóa học mới</Link>
      </div>
      <p className="muted">Khóa học “Đang hiển thị” sẽ xuất hiện trên website công khai. Lớp học cụ thể được mở từ một khóa học.</p>
      {!courses.length ? <Empty>Chưa có khóa học.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tên khóa</th><th>Nhóm</th><th>Môn</th><th>Hình thức</th><th>Số lớp</th><th>Hiển thị</th></tr></thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td><Link href={`/quan-tri/khoa-hoc/${course.id}`}>{course.title}</Link></td>
                  <td>{categoryLabels[course.category]}</td>
                  <td>{course.subject}</td>
                  <td>{course._count.offerings}</td>
                  <td>{course._count.classes}</td>
                  <td><Badge tone={course.status === "PUBLISHED" ? "good" : "default"}>{publicationLabels[course.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
