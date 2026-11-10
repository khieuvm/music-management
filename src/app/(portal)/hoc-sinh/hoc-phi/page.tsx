import { Empty } from "@/components/fields";
import { FinancePanel } from "@/components/portal/finance-panel";
import { getDb } from "@/lib/db";
import { getEnrollmentFinance } from "@/lib/services/fees";
import { requireStudent } from "@/lib/student";

export const metadata = { title: "Học phí" };

export default async function StudentFeesPage() {
  const { studentId } = await requireStudent();
  const db = getDb();
  const enrollments = await db.enrollment.findMany({ where: { studentId }, orderBy: { enrolledAt: "desc" }, select: { id: true } });
  const finances = (await Promise.all(enrollments.map((item) => getEnrollmentFinance(db, item.id)))).filter((item) => item !== null);
  return (
    <>
      <div className="page-head"><h1>Học phí</h1></div>
      <p className="muted">Thông tin đóng phí được giáo vụ cập nhật sau khi nhận tiền. Nếu có sai lệch, vui lòng liên hệ trung tâm.</p>
      {!finances.length && <Empty>Chưa có khoản học phí nào.</Empty>}
      {finances.map((finance) => (
        <section className="panel" key={finance.enrollment.id}>
          <h2>{finance.enrollment.classGroup.name}</h2>
          <FinancePanel finance={finance} mode="student" />
        </section>
      ))}
    </>
  );
}
