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

/** Installments due within this many days are flagged "sắp đến hạn". */
export const DUE_SOON_DAYS = 7;

export type InstallmentState = "PAID" | "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";

const DAY_MS = 86_400_000;

/**
 * Apply the paid total to installments in due-date order. `today` is the local calendar day as a UTC-midnight
 * Date (same encoding as the DATE column), so day differences are exact.
 */
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
      const daysUntilDue = Math.round((item.dueDate.getTime() - today.getTime()) / DAY_MS);
      const state: InstallmentState = outstanding === 0 ? "PAID"
        : daysUntilDue < 0 ? "OVERDUE"
          : daysUntilDue === 0 ? "DUE_TODAY"
            : daysUntilDue <= DUE_SOON_DAYS ? "DUE_SOON" : "UPCOMING";
      return { ...item, coveredVnd: covered, outstandingVnd: outstanding, partial: covered > 0 && outstanding > 0, daysUntilDue, state };
    });
}

/** Most urgent state first; used to rank an enrollment by its worst unpaid installment. */
export const stateUrgency: Record<InstallmentState, number> = { OVERDUE: 0, DUE_TODAY: 1, DUE_SOON: 2, UPCOMING: 3, PAID: 4 };

export function worstState(items: { state: InstallmentState }[]): InstallmentState {
  return items.reduce<InstallmentState>((worst, item) => stateUrgency[item.state] < stateUrgency[worst] ? item.state : worst, "PAID");
}

export const installmentStateLabels: Record<InstallmentState, string> = {
  PAID: "Đã đủ",
  OVERDUE: "Quá hạn",
  DUE_TODAY: "Đến hạn hôm nay",
  DUE_SOON: "Sắp đến hạn",
  UPCOMING: "Chưa đến hạn",
};

/** CSS tone per state: green / red / orange / yellow / grey. */
export const installmentStateTone = { PAID: "good", OVERDUE: "bad", DUE_TODAY: "alert", DUE_SOON: "warn", UPCOMING: "default" } as const;

export function installmentStateText(item: { state: InstallmentState; daysUntilDue: number }) {
  if (item.state === "OVERDUE") return `Quá hạn ${-item.daysUntilDue} ngày`;
  if (item.state === "DUE_SOON") return `Còn ${item.daysUntilDue} ngày`;
  return installmentStateLabels[item.state];
}
