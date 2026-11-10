import { addDays, addMonths, isDateString, localDateKey } from "@/lib/time";

/** Defaults to the current calendar month in Vietnam. */
export function resolvePeriod(fromRaw: string, toRaw: string) {
  const today = localDateKey(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isDateString(fromRaw) ? fromRaw : monthStart;
  let to = isDateString(toRaw) ? toRaw : addDays(addMonths(monthStart, 1), -1);
  if (to < from) to = from;
  if (addDays(from, 366) < to) to = addDays(from, 366);
  return { from, to };
}

export function PeriodFilter({ from, to }: { from: string; to: string }) {
  return (
    <form className="search-bar">
      <label>Từ <input type="date" name="tu" defaultValue={from} /></label>
      <label>Đến <input type="date" name="den" defaultValue={to} /></label>
      <button className="button small" type="submit">Xem</button>
    </form>
  );
}
