import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { firstParam } from "@/lib/page";
import { paymentLedger } from "@/lib/services/fees";
import { formatDate, isDateString, localDateKey } from "@/lib/time";

export const metadata = { title: "Sổ thu tiền" };

export default async function PaymentLedgerPage({ searchParams }: PageProps<"/quan-tri/thu-tien">) {
  const params = await searchParams;
  const today = localDateKey(new Date());
  const rawFrom = firstParam(params.tu);
  const rawTo = firstParam(params.den);
  const from = isDateString(rawFrom) ? rawFrom : `${today.slice(0, 8)}01`;
  const to = isDateString(rawTo) && rawTo >= from ? rawTo : today;
  const method = firstParam(params.hinh_thuc);
  const ledger = await paymentLedger(getDb(), { from, to, method });
  const query = new URLSearchParams({ tu: from, den: to, ...(method ? { hinh_thuc: method } : {}) });
  return (
    <>
      <div className="page-head">
        <h1>Sổ thu tiền</h1>
        <p className="muted">Các phiếu thu đã ghi nhận theo ngày thu. Phiếu đã hủy được gạch ngang và không cộng vào tổng.</p>
      </div>
      <form className="search-bar" role="search">
        <label>Từ <input type="date" name="tu" defaultValue={from} max={today} /></label>
        <label>Đến <input type="date" name="den" defaultValue={to} max={today} /></label>
        <select name="hinh_thuc" defaultValue={method} aria-label="Hình thức">
          <option value="">Mọi hình thức</option>
          {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="button small" type="submit">Xem</button>
        <a className="button small secondary" href={`/api/bao-cao/thu-tien?${query}`}>Xuất CSV</a>
      </form>
      <div className="stat-grid compact">
        <div className="stat tone-good"><strong>{formatVnd(ledger.totals.all)}</strong><span>Tổng thu · {ledger.totals.count} phiếu</span></div>
        <div className="stat"><strong>{formatVnd(ledger.totals.cash)}</strong><span>Tiền mặt</span></div>
        <div className="stat"><strong>{formatVnd(ledger.totals.transfer)}</strong><span>Chuyển khoản</span></div>
        <div className="stat"><strong>{ledger.totals.voided}</strong><span>Phiếu đã hủy</span></div>
      </div>
      {!ledger.payments.length ? <Empty>Không có phiếu thu trong khoảng này.</Empty> : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead><tr><th>Phiếu</th><th>Ngày</th><th>Học sinh</th><th>Lớp</th><th>Số tiền</th><th>Hình thức</th><th>Người thu</th></tr></thead>
            <tbody>
              {ledger.payments.map((payment) => (
                <tr key={payment.id} className={payment.voidedAt ? "voided" : undefined}>
                  <td data-label="Phiếu"><Link href={`/quan-tri/phieu-thu/${payment.id}`}>#{payment.receiptNo}</Link>{payment.voidedAt && <> <Badge tone="bad">Đã hủy</Badge></>}</td>
                  <td data-label="Ngày">{formatDate(payment.paidAt)}</td>
                  <td data-label="Học sinh"><Link href={`/quan-tri/hoc-sinh/${payment.enrollment.student.id}`}>{payment.enrollment.student.fullName}</Link><br /><span className="muted">{payment.enrollment.student.code}</span></td>
                  <td data-label="Lớp">{payment.enrollment.classGroup.code}</td>
                  <td data-label="Số tiền">{formatVnd(payment.amountVnd)}</td>
                  <td data-label="Hình thức">{paymentMethodLabels[payment.method]}</td>
                  <td data-label="Người thu">{payment.receivedBy.displayName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
