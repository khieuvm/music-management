import { Empty } from "@/components/fields";
import { formatVnd } from "@/lib/format";
import { formatHours } from "@/lib/payroll";
import type { teachingReport } from "@/lib/services/reports";

export function TeachingReportView({ report }: { report: Awaited<ReturnType<typeof teachingReport>> }) {
  if (!report.length) return <Empty>Chưa có buổi dạy nào được xác nhận (điểm danh) trong khoảng thời gian này.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Giáo viên</th><th>Số buổi</th><th>Tổng giờ</th><th>Giờ buổi tối</th><th>Giờ cuối tuần</th><th>Tiền tạm tính</th></tr></thead>
        <tbody>
          {report.map((group) => (
            <tr key={group.teacher.id}>
              <td>{group.teacher.fullName}</td>
              <td>{group.summary.lessons}</td>
              <td>{formatHours(group.summary.minutes)}</td>
              <td>{formatHours(group.summary.eveningMinutes)}</td>
              <td>{formatHours(group.summary.weekendMinutes)}</td>
              <td>
                {formatVnd(group.summary.payVnd)}
                {group.summary.unpricedLessons > 0 && <><br /><span className="muted">{group.summary.unpricedLessons} buổi chưa có đơn giá</span></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
