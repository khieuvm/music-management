import { PeriodFilter, resolvePeriod } from "@/components/portal/period-filter";
import { TeachingReportView } from "@/components/portal/teaching-report";
import { getDb } from "@/lib/db";
import { firstParam } from "@/lib/page";
import { teachingReport } from "@/lib/services/reports";
import { requireTeacher } from "@/lib/teacher";

export const metadata = { title: "Giờ dạy của tôi" };

export default async function TeacherHoursPage({ searchParams }: PageProps<"/giao-vien/gio-day">) {
  const { teacherId } = await requireTeacher();
  const params = await searchParams;
  const { from, to } = resolvePeriod(firstParam(params.tu), firstParam(params.den));
  const report = await teachingReport(getDb(), from, to, teacherId);
  return (
    <>
      <div className="page-head"><h1>Giờ dạy của tôi</h1></div>
      <p className="muted">Gồm các buổi bạn đã điểm danh. Buổi chưa điểm danh sẽ không được tính giờ. Tiền tạm tính theo đơn giá trung tâm đang cấu hình; số chính thức do giáo vụ chốt.</p>
      <PeriodFilter from={from} to={to} />
      <section className="panel"><TeachingReportView report={report} /></section>
    </>
  );
}
