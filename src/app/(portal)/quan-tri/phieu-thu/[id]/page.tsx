import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { isUuid } from "@/lib/page";
import { getEnrollmentFinance } from "@/lib/services/fees";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata = { title: "Phiếu thu" };

export default async function ReceiptPage({ params }: PageProps<"/quan-tri/phieu-thu/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      receivedBy: { select: { displayName: true } },
      enrollment: {
        select: {
          id: true, tuitionVnd: true,
          student: { select: { id: true, code: true, fullName: true, parentName: true, parentPhone: true } },
          classGroup: { select: { code: true, name: true, course: { select: { title: true } } } },
        },
      },
    },
  });
  if (!payment) notFound();
  const finance = await getEnrollmentFinance(db, payment.enrollment.id);
  const { student, classGroup } = payment.enrollment;
  return (
    <>
      <p className="no-print"><Link href={`/quan-tri/hoc-sinh/${student.id}#ghi-danh-${payment.enrollment.id}`}>← Hồ sơ học sinh</Link> · <Link href="/quan-tri/thu-tien">Sổ thu tiền</Link></p>
      <article className="receipt panel">
        <header className="row-between">
          <div><strong>Không gian âm nhạc</strong><br /><span className="muted">Phiếu thu học phí</span></div>
          <div className="receipt-no">Số: <strong>#{payment.receiptNo}</strong></div>
        </header>
        {payment.voidedAt && <p className="status error">PHIẾU ĐÃ HỦY ngày {formatDateTime(payment.voidedAt)} — {payment.voidReason}</p>}
        <dl className="receipt-grid">
          <dt>Ngày thu</dt><dd>{formatDate(payment.paidAt)}</dd>
          <dt>Học sinh</dt><dd>{student.fullName} ({student.code})</dd>
          <dt>Phụ huynh</dt><dd>{student.parentName || "—"}{student.parentPhone ? ` · ${student.parentPhone}` : ""}</dd>
          <dt>Lớp / khóa</dt><dd>{classGroup.name} ({classGroup.code}) · {classGroup.course.title}</dd>
          <dt>Số tiền</dt><dd><strong className="receipt-amount">{formatVnd(payment.amountVnd)}</strong></dd>
          <dt>Hình thức</dt><dd>{paymentMethodLabels[payment.method]}</dd>
          {payment.note && <><dt>Ghi chú</dt><dd>{payment.note}</dd></>}
          {finance && <><dt>Học phí cả khóa</dt><dd>{formatVnd(payment.enrollment.tuitionVnd)} · đã đóng {formatVnd(finance.paidVnd)} · còn lại {formatVnd(finance.outstandingVnd)}</dd></>}
        </dl>
        <div className="receipt-sign">
          <div><span>Người nộp</span><em>(ký, ghi rõ họ tên)</em></div>
          <div><span>Người thu</span><em>{payment.receivedBy.displayName}</em></div>
        </div>
      </article>
      <p className="no-print"><PrintButton /></p>
    </>
  );
}
