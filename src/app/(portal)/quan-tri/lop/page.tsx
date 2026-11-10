import Link from "next/link";
import { saveClassAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { ClassFields, classOptions } from "@/components/portal/class-fields";
import { getDb } from "@/lib/db";
import { classFormatLabels, deliveryLabels, formatVnd } from "@/lib/format";
import { classStatusLabels } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Lớp học" };

export default async function ClassesPage({ searchParams }: PageProps<"/quan-tri/lop">) {
  const all = firstParam((await searchParams).tat_ca) === "1";
  const db = getDb();
  const [classes, options] = await Promise.all([
    db.classGroup.findMany({
      where: all ? {} : { status: { in: ["PLANNED", "ACTIVE"] } },
      include: {
        course: { select: { title: true } }, teacher: { select: { fullName: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    classOptions(db),
  ]);
  return (
    <>
      <div className="page-head row-between">
        <h1>Lớp học</h1>
        <Link href={all ? "/quan-tri/lop" : "/quan-tri/lop?tat_ca=1"}>{all ? "Chỉ lớp đang mở" : "Xem cả lớp đã kết thúc/hủy"}</Link>
      </div>
      <details className="panel">
        <summary><strong>+ Mở lớp mới</strong></summary>
        {!options.courses.length || !options.teachers.length
          ? <p className="status error">Cần có ít nhất một khóa học và một giáo viên đang dạy trước khi mở lớp.</p>
          : <ActionForm action={saveClassAction} submitLabel="Tạo lớp"><input type="hidden" name="id" value="" /><ClassFields {...options} /></ActionForm>}
      </details>
      {!classes.length ? <Empty>Chưa có lớp.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Lớp</th><th>Khóa</th><th>Giáo viên</th><th>Hình thức</th><th>Sĩ số</th><th>Học phí</th><th>Bắt đầu</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id}>
                  <td><Link href={`/quan-tri/lop/${item.id}`}>{item.name}</Link><br /><span className="muted">{item.code}</span></td>
                  <td>{item.course.title}</td>
                  <td>{item.teacher.fullName}</td>
                  <td>{deliveryLabels[item.deliveryMode]} · {classFormatLabels[item.format]}</td>
                  <td>{item._count.enrollments}/{item.capacity}</td>
                  <td>{formatVnd(item.tuitionVnd)}</td>
                  <td>{formatDate(item.startDate, true)}</td>
                  <td><Badge tone={item.status === "ACTIVE" ? "good" : item.status === "CANCELLED" ? "bad" : "default"}>{classStatusLabels[item.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
