import { recordPaymentAction, replanInstallmentsAction, voidPaymentAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Field, Select } from "@/components/fields";
import { installmentStateLabels } from "@/lib/fees";
import { formatVnd } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import type { getEnrollmentFinance } from "@/lib/services/fees";
import { dateOnlyKey, formatDate, localDateKey } from "@/lib/time";

type Finance = NonNullable<Awaited<ReturnType<typeof getEnrollmentFinance>>>;
type Mode = "student" | "staff" | "admin";

const stateTone = { PAID: "good", PARTIAL: "warn", OVERDUE: "bad", UPCOMING: "default" } as const;

export function FinancePanel({ finance, mode }: { finance: Finance; mode: Mode }) {
  const { enrollment, paidVnd, outstandingVnd, installments } = finance;
  const today = localDateKey(new Date());
  return (
    <div className="stack">
      <p>
        Học phí: <strong>{formatVnd(enrollment.tuitionVnd)}</strong> · Đã đóng: <strong>{formatVnd(paidVnd)}</strong> ·
        Còn lại: <strong>{formatVnd(outstandingVnd)}</strong>
      </p>
      {installments.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Đợt</th><th>Hạn</th><th>Số tiền</th><th>Còn thiếu</th><th>Tình trạng</th></tr></thead>
            <tbody>
              {installments.map((item) => (
                <tr key={item.id}>
                  <td>{item.sequence}</td>
                  <td>{formatDate(item.dueDate, true)}</td>
                  <td>{formatVnd(item.amountVnd)}</td>
                  <td>{formatVnd(item.outstandingVnd)}</td>
                  <td><Badge tone={stateTone[item.state]}>{installmentStateLabels[item.state]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {enrollment.payments.length > 0 && (
        <details open={mode !== "student"}>
          <summary>Lịch sử thanh toán ({enrollment.payments.length})</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Phiếu</th><th>Ngày</th><th>Số tiền</th><th>Hình thức</th>{mode !== "student" && <th>Người thu</th>}<th>Ghi chú</th></tr></thead>
              <tbody>
                {enrollment.payments.map((payment) => (
                  <tr key={payment.id} className={payment.voidedAt ? "voided" : undefined}>
                    <td>#{payment.receiptNo}</td>
                    <td>{formatDate(payment.paidAt)}</td>
                    <td>{formatVnd(payment.amountVnd)}</td>
                    <td>{paymentMethodLabels[payment.method]}</td>
                    {mode !== "student" && <td>{payment.receivedBy.displayName}</td>}
                    <td>
                      {payment.voidedAt ? <Badge tone="bad">Đã hủy: {payment.voidReason}</Badge> : payment.note}
                      {mode === "admin" && !payment.voidedAt && (
                        <details>
                          <summary>Hủy phiếu</summary>
                          <ActionForm action={voidPaymentAction} submitLabel="Xác nhận hủy phiếu" danger confirmMessage="Hủy phiếu thu này? Thao tác được ghi nhật ký.">
                            <input type="hidden" name="paymentId" value={payment.id} />
                            <Field label="Lý do hủy" name="reason" id={`void-${payment.id}`} required maxLength={300} />
                          </ActionForm>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {mode !== "student" && (
        <div className="grid-2">
          {outstandingVnd > 0 && (
            <details>
              <summary>Ghi nhận thanh toán</summary>
              <ActionForm action={recordPaymentAction} submitLabel="Ghi nhận" idempotent resetOnSuccess>
                <input type="hidden" name="enrollmentId" value={enrollment.id} />
                <Field label="Số tiền (VND)" name="amountVnd" id={`amount-${enrollment.id}`} inputMode="numeric" pattern="[0-9]*" required defaultValue={String(outstandingVnd)} />
                <Select label="Hình thức" name="method" id={`method-${enrollment.id}`} defaultValue="TRANSFER">
                  {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Field label="Ngày thu" name="paidDate" id={`paid-${enrollment.id}`} type="date" required defaultValue={today} max={today} />
                <Field label="Ghi chú" name="note" id={`pnote-${enrollment.id}`} maxLength={500} />
              </ActionForm>
            </details>
          )}
          <details>
            <summary>Đổi học phí / lịch đóng</summary>
            <ActionForm action={replanInstallmentsAction} submitLabel="Cập nhật lịch đóng">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <Field label="Học phí cả khóa (VND)" name="tuitionVnd" id={`tuition-${enrollment.id}`} inputMode="numeric" pattern="[0-9]*" required defaultValue={String(enrollment.tuitionVnd)} />
              <Field label="Số đợt" name="installmentCount" id={`count-${enrollment.id}`} type="number" min={1} max={12} required defaultValue={String(installments.length || 1)} />
              <Field label="Hạn đợt đầu" name="firstDueDate" id={`first-${enrollment.id}`} type="date" required defaultValue={installments[0] ? dateOnlyKey(installments[0].dueDate) : today} />
              <Field label="Lý do (bắt buộc nếu đổi học phí)" name="reason" id={`reason-${enrollment.id}`} maxLength={300} />
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}
