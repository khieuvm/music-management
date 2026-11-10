import Link from "next/link";
import { PeriodFilter, resolvePeriod } from "@/components/portal/period-filter";
import { TeachingReportView } from "@/components/portal/teaching-report";
import { getDb } from "@/lib/db";
import { firstParam } from "@/lib/page";
import { teachingReport } from "@/lib/services/reports";

export const metadata = { title: "Giờ dạy" };

export default async function TeachingHoursPage({ searchParams }: PageProps<"/quan-tri/gio-day">) {
  const params = await searchParams;
  const { from, to } = resolvePeriod(firstParam(params.tu), firstParam(params.den));
  const report = await teachingReport(getDb(), from, to);
  return (
    <>
      <div className="page-head"><h1>Giờ dạy giáo viên</h1></div>
      <p className="muted">Chỉ tính các buổi giáo viên đã điểm danh (xác nhận đã dạy). Cuối tuần là Thứ 7 và Chủ nhật; giờ bắt đầu buổi tối và tiền tạm tính lấy theo <Link href="/quan-tri/luong">đơn giá lương</Link>. CSV có chi tiết từng buổi để đối chiếu.</p>
      <PeriodFilter from={from} to={to} />
      <section className="panel">
        <TeachingReportView report={report} />
        <p><a className="button small" href={`/api/bao-cao/gio-day?tu=${from}&den=${to}`}>Tải CSV chi tiết từng buổi</a></p>
      </section>
    </>
  );
}
