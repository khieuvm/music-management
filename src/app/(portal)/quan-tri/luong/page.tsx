import Link from "next/link";
import { createPayRateAction, deletePayRateAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Select, TextArea } from "@/components/fields";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatVnd } from "@/lib/format";
import { minutesToTime } from "@/lib/payroll";
import { listPayRates } from "@/lib/services/pay-rates";
import { dateOnlyKey, formatDate, localDateKey } from "@/lib/time";

export const metadata = { title: "Đơn giá lương" };

export default async function PayRatesPage() {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const db = getDb();
  const [rates, teachers] = await Promise.all([
    listPayRates(db),
    db.teacher.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const now = new Date();
  const today = localDateKey(now);
  // Rates are sorted newest first, so the first one already in effect per owner is the current one.
  const current = new Set<string>();
  const seen = new Set<string | null>();
  for (const rate of rates) {
    if (dateOnlyKey(rate.effectiveFrom) > today || seen.has(rate.teacherId)) continue;
    seen.add(rate.teacherId);
    current.add(rate.id);
  }
  const admin = actor.role === "ADMIN";
  return (
    <>
      <div className="page-head"><h1>Đơn giá lương & phụ cấp</h1></div>
      <p className="muted">
        Tiền mỗi buổi = số giờ × lương/giờ + giờ buổi tối × phụ cấp tối/giờ + giờ cuối tuần (Thứ 7, Chủ nhật) × phụ cấp cuối tuần/giờ + phụ cấp mỗi buổi.
        Buổi tối cuối tuần được cộng cả hai phụ cấp. Đơn giá riêng của giáo viên được ưu tiên hơn đơn giá chung; mỗi buổi dùng đơn giá có ngày áp dụng gần nhất trước ngày dạy.
        Muốn đổi giá, hãy thêm đơn giá mới từ ngày áp dụng mới — các tháng trước vẫn giữ cách tính cũ. Kết quả xem ở <Link href="/quan-tri/gio-day">Giờ dạy</Link>.
      </p>
      {admin ? (
        <details className="panel" open={!rates.length}>
          <summary><strong>+ Thêm đơn giá</strong></summary>
          <ActionForm action={createPayRateAction} submitLabel="Lưu đơn giá" resetOnSuccess>
            <div className="form-grid">
              <Select label="Áp dụng cho" name="teacherId" defaultValue="">
                <option value="">Tất cả giáo viên (đơn giá chung)</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
              </Select>
              <Field label="Ngày áp dụng" name="effectiveFrom" type="date" required defaultValue={localDateKey(now)} />
              <Field label="Lương mỗi giờ (đ)" name="hourlyVnd" type="number" min={0} step={1000} required inputMode="numeric" />
              <Field label="Phụ cấp buổi tối mỗi giờ (đ)" name="eveningExtraVnd" type="number" min={0} step={1000} defaultValue={0} inputMode="numeric" />
              <Field label="Buổi tối tính từ" name="eveningStart" type="time" defaultValue="18:00" required />
              <Field label="Phụ cấp cuối tuần mỗi giờ (đ)" name="weekendExtraVnd" type="number" min={0} step={1000} defaultValue={0} inputMode="numeric" />
              <Field label="Phụ cấp mỗi buổi (đ)" name="perLessonVnd" type="number" min={0} step={1000} defaultValue={0} inputMode="numeric"
                hint="Ví dụ: tiền đi lại, cố định mỗi buổi dạy." />
            </div>
            <TextArea label="Ghi chú" name="note" maxLength={300} rows={2} />
          </ActionForm>
        </details>
      ) : <p className="muted">Chỉ quản lý được thêm hoặc xóa đơn giá.</p>}
      <section className="panel">
        <h2>Các đơn giá</h2>
        {!rates.length ? <Empty>Chưa có đơn giá. Báo cáo giờ dạy sẽ hiện “Chưa có đơn giá” cho tới khi quản lý nhập.</Empty> : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead><tr><th>Áp dụng cho</th><th>Từ ngày</th><th>Lương/giờ</th><th>Tối (từ)</th><th>Cuối tuần/giờ</th><th>Mỗi buổi</th><th>Ghi chú</th>{admin && <th></th>}</tr></thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id}>
                    <td data-label="Áp dụng cho">
                      {rate.teacher?.fullName ?? <strong>Tất cả giáo viên</strong>}{" "}
                      {current.has(rate.id) ? <Badge tone="good">Đang áp dụng</Badge>
                        : dateOnlyKey(rate.effectiveFrom) > today ? <Badge tone="warn">Sắp áp dụng</Badge> : <Badge>Cũ</Badge>}
                    </td>
                    <td data-label="Từ ngày">{formatDate(rate.effectiveFrom, true)}</td>
                    <td data-label="Lương/giờ">{formatVnd(rate.hourlyVnd)}</td>
                    <td data-label="Tối (từ)">+{formatVnd(rate.eveningExtraVnd)}/giờ ({minutesToTime(rate.eveningStartMinutes)})</td>
                    <td data-label="Cuối tuần/giờ">+{formatVnd(rate.weekendExtraVnd)}</td>
                    <td data-label="Mỗi buổi">+{formatVnd(rate.perLessonVnd)}</td>
                    <td data-label="Ghi chú">{rate.note}<br /><span className="muted">{rate.createdBy.displayName}</span></td>
                    {admin && (
                      <td>
                        <ActionForm action={deletePayRateAction} submitLabel="Xóa" className="mini-form" danger
                          confirmMessage={`Xóa đơn giá từ ${dateOnlyKey(rate.effectiveFrom)}? Báo cáo các tháng dùng đơn giá này sẽ tính lại.`}>
                          <input type="hidden" name="id" value={rate.id} />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
