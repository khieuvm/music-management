export const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Vietnam has no daylight saving time, so a fixed offset is exact.
const OFFSET = "+07:00";
const OFFSET_MS = 7 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function isTimeString(value: string) {
  return TIME_RE.test(value);
}

/** Local Vietnamese date + time → absolute instant. */
export function localDateTime(date: string, time: string) {
  if (!isDateString(date) || !isTimeString(time)) throw new RangeError("Invalid local date/time");
  return new Date(`${date}T${time}:00${OFFSET}`);
}

/** Calendar date stored in a PostgreSQL DATE column (UTC midnight). */
export function dateOnly(date: string) {
  if (!isDateString(date)) throw new RangeError("Invalid date");
  return new Date(`${date}T00:00:00Z`);
}

export function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Calendar date (YYYY-MM-DD) of an instant in Vietnam. */
export function localDateKey(instant: Date) {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function localTimeKey(instant: Date) {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** Weekday (0 = Sunday) and minutes since local midnight of an instant in Vietnam. */
export function localParts(instant: Date) {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return { weekday: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

export function addDays(date: string, days: number) {
  const value = dateOnly(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateOnlyKey(value);
}

export function addMonths(date: string, months: number) {
  const value = dateOnly(date);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return dateOnlyKey(value);
}

export const weekdayLabels = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export function formatDateTime(instant: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(instant);
}

export function formatTime(instant: Date) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function formatDate(date: Date, dateOnlyValue = false) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: dateOnlyValue ? "UTC" : TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}

/** Start of the given local day (or today) as an instant. */
export function startOfLocalDay(date = localDateKey(new Date())) {
  return localDateTime(date, "00:00");
}
