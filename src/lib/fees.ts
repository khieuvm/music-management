import { addMonths, dateOnly } from "@/lib/time";

export type InstallmentPlan = { sequence: number; dueDate: Date; amountVnd: number };

/** Split a course fee into monthly installments, rounded to 1,000 VND; the last one absorbs the remainder. */
export function splitInstallments(totalVnd: number, count: number, firstDueDate: string): InstallmentPlan[] {
  if (!Number.isInteger(totalVnd) || totalVnd < 0) throw new RangeError("Học phí không hợp lệ.");
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new RangeError("Số đợt phải từ 1 đến 12.");
  const base = Math.floor(totalVnd / count / 1000) * 1000;
  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    dueDate: dateOnly(addMonths(firstDueDate, index)),
    amountVnd: index === count - 1 ? totalVnd - base * (count - 1) : base,
  }));
}

export type InstallmentState = "PAID" | "PARTIAL" | "OVERDUE" | "UPCOMING";

/** Apply the paid total to installments in due-date order. */
export function allocatePayments<T extends { dueDate: Date; amountVnd: number }>(
  installments: T[], paidVnd: number, today: Date,
) {
  let remaining = paidVnd;
  return [...installments]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .map((item) => {
      const covered = Math.min(item.amountVnd, Math.max(remaining, 0));
      remaining -= covered;
      const outstanding = item.amountVnd - covered;
      const state: InstallmentState = outstanding === 0 ? "PAID"
        : item.dueDate < today ? "OVERDUE"
          : covered > 0 ? "PARTIAL" : "UPCOMING";
      return { ...item, coveredVnd: covered, outstandingVnd: outstanding, state };
    });
}

export const installmentStateLabels: Record<InstallmentState, string> = {
  PAID: "Đã đủ",
  PARTIAL: "Đã trả một phần",
  OVERDUE: "Quá hạn",
  UPCOMING: "Chưa đến hạn",
};
