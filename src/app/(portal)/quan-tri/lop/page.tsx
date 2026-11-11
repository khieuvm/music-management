import Link from "next/link";
import { saveClassAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { ClassFields, classOptions } from "@/components/portal/class-fields";
import { FlagList, ProgressMeter } from "@/components/portal/class-overview";
import { getDb } from "@/lib/db";
import { classFormatLabels, deliveryLabels, formatVnd } from "@/lib/format";
import { classStatusLabels, classStatusTone } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { classBoard, syncClassStatuses } from "@/lib/services/class-progress";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata = { title: "Lớp học" };

const statusFilters = { "dang-mo": ["PLANNED", "ACTIVE"], "sap-mo": ["PLANNED"], "dang-hoc": ["ACTIVE"], "ket-thuc": ["FINISHED"], "da-huy": ["CANCELLED"], "tat-ca": ["PLANNED", "ACTIVE", "FINISHED", "CANCELLED"] } as const;
const statusFilterLabels: Record<keyof typeof statusFilters, string> = {
  "dang-mo": "Đang mở (sắp mở + đang học)", "sap-mo": "Sắp mở", "dang-hoc": "Đang học", "ket-thuc": "Đã kết thúc", "da-huy": "Đã hủy", "tat-ca": "Tất cả",
};

export default async function ClassesPage({ searchParams }: PageProps<"/quan-tri/lop">) {
  const params = await searchParams;
  const rawStatus = firstParam(params.trang_thai) || (firstParam(params.tat_ca) === "1" ? "tat-ca" : "dang-mo");
  const statusKey = (rawStatus in statusFilters ? rawStatus : "dang-mo") as keyof typeof statusFilters;
  const q = firstParam(params.q).trim().slice(0, 100);
  const teacherId = firstParam(params.gv);
  const onlyAttention = firstParam(params.can_xu_ly) === "1";
  const db = getDb();
  await syncClassStatuses(db);
  const [rows, options] = await Promise.all([
    classBoard(db, {
      status: { in: [...statusFilters[statusKey]] },
      ...(teacherId && /^[0-9a-f-]{36}$/i.test(teacherId) ? { teacherId } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { code: { contains: q, mode: "insensitive" as const } }, { course: { title: { contains: q, mode: "insensitive" as const } } }] } : {}),
    }),
    classOptions(db),
  ]);
  const attention = rows.filter((row) => row.needsAttention);
  const visible = onlyAttention ? attention : rows;
  return (
    <>
      <div className="page-head">
        <h1>Lớp học</h1>
        <p className="muted">Lớp “Sắp mở” tự chuyển sang “Đang học” khi buổi đầu tiên bắt đầu. Kết thúc / hủy lớp ở trang chi tiết lớp.</p>
      </div>
      <details className="panel">
        <summary><strong>+ Mở lớp mới</strong></summary>
        {!options.courses.length || !options.teachers.length
          ? <p className="status error">Cần có ít nhất một khóa học và một giáo viên đang dạy trước khi mở lớp.</p>
          : <ActionForm action={saveClassAction} submitLabel="Tạo lớp"><input type="hidden" name="id" value="" /><ClassFields {...options} /></ActionForm>}
      </details>
      <form className="search-bar" role="search">
        <select name="trang_thai" defaultValue={statusKey} aria-label="Trạng thái lớp">
          {Object.entries(statusFilterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="gv" defaultValue={teacherId} aria-label="Giáo viên">
          <option value="">Mọi giáo viên</option>
          {options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Tên lớp, mã lớp, khóa học…" aria-label="Tìm lớp" />
        <label><input type="checkbox" name="can_xu_ly" value="1" defaultChecked={onlyAttention} /> Chỉ lớp cần xử lý ({attention.length})</label>
        <button className="button small" type="submit">Lọc</button>
      </form>
      {!visible.length ? <Empty>Không có lớp phù hợp.</Empty> : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead><tr><th>Lớp</th><th>Giáo viên</th><th>Sĩ số</th><th>Tiến độ</th><th>Buổi kế tiếp</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {visible.map(({ item, progress, flags }) => (
                <tr key={item.id}>
                  <td data-label="Lớp"><Link href={`/quan-tri/lop/${item.id}`}>{item.name}</Link><br /><span className="muted">{item.code} · {item.course.title} · {deliveryLabels[item.deliveryMode]} · {classFormatLabels[item.format]} · {formatVnd(item.tuitionVnd)}</span></td>
                  <td data-label="Giáo viên">{item.teacher.fullName}</td>
                  <td data-label="Sĩ số">{item._count.enrollments}/{item.capacity}</td>
                  <td data-label="Tiến độ"><ProgressMeter progress={progress} /></td>
                  <td data-label="Buổi kế tiếp">{progress.nextLessonAt ? formatDateTime(progress.nextLessonAt) : <span className="muted">—</span>}<br /><span className="muted">KG {formatDate(item.startDate, true)}</span></td>
                  <td data-label="Trạng thái"><Badge tone={classStatusTone[item.status]}>{classStatusLabels[item.status]}</Badge><FlagList flags={flags} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
