import { addDays, dateOnly, localDateTime } from "@/lib/time";

export const MAX_GENERATED_LESSONS = 200;

export type WeeklyPattern = {
  fromDate: string;
  toDate: string;
  weekdays: number[];
  startTime: string;
  durationMinutes: number;
};

export function generateOccurrences(pattern: WeeklyPattern) {
  const days = new Set(pattern.weekdays);
  if (!days.size || [...days].some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new RangeError("Chọn ít nhất một ngày trong tuần hợp lệ.");
  }
  if (!Number.isInteger(pattern.durationMinutes) || pattern.durationMinutes < 15 || pattern.durationMinutes > 600) {
    throw new RangeError("Thời lượng buổi học phải từ 15 đến 600 phút.");
  }
  if (dateOnly(pattern.toDate) < dateOnly(pattern.fromDate)) {
    throw new RangeError("Ngày kết thúc phải sau ngày bắt đầu.");
  }
  const result: { startsAt: Date; endsAt: Date }[] = [];
  for (let date = pattern.fromDate; date <= pattern.toDate; date = addDays(date, 1)) {
    if (!days.has(dateOnly(date).getUTCDay())) continue;
    const startsAt = localDateTime(date, pattern.startTime);
    result.push({ startsAt, endsAt: new Date(startsAt.getTime() + pattern.durationMinutes * 60_000) });
    if (result.length > MAX_GENERATED_LESSONS) {
      throw new RangeError(`Mỗi lần chỉ tạo tối đa ${MAX_GENERATED_LESSONS} buổi.`);
    }
  }
  return result;
}

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
