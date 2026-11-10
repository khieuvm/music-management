import { dateOnlyKey, localDateKey, localParts } from "@/lib/time";

/** Default evening start (18:00 local time) when no pay rate overrides it. */
export const EVENING_START_MINUTES = 18 * 60;

export type TeachingSlot = { startsAt: Date; endsAt: Date };

export type Rate = {
  teacherId: string | null;
  effectiveFrom: Date;
  hourlyVnd: number;
  eveningExtraVnd: number;
  weekendExtraVnd: number;
  perLessonVnd: number;
  eveningStartMinutes: number;
};

export function classifyTeaching({ startsAt, endsAt }: TeachingSlot, eveningStartMinutes = EVENING_START_MINUTES) {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  let eveningMinutes = 0;
  let weekendMinutes = 0;
  for (let offset = 0; offset < minutes; offset += 1) {
    const parts = localParts(new Date(startsAt.getTime() + offset * 60_000));
    if (parts.minutes >= eveningStartMinutes) eveningMinutes += 1;
    if (parts.weekday === 0 || parts.weekday === 6) weekendMinutes += 1;
  }
  return { minutes, eveningMinutes, weekendMinutes };
}

/** The teacher's own rate wins over the centre default; within each, the latest effective on the lesson date. */
export function resolveRate<R extends Rate>(rates: R[], teacherId: string, startsAt: Date): R | null {
  const day = localDateKey(startsAt);
  const latest = (owner: string | null) => rates
    .filter((rate) => rate.teacherId === owner && dateOnlyKey(rate.effectiveFrom) <= day)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
  return latest(teacherId) ?? latest(null);
}

/** Pay for one lesson: base hourly + evening/weekend extras per hour (they stack) + a fixed per-lesson allowance. */
export function lessonPay(slot: TeachingSlot, rate: Rate) {
  const item = classifyTeaching(slot, rate.eveningStartMinutes);
  const payVnd = Math.round(
    (item.minutes * rate.hourlyVnd + item.eveningMinutes * rate.eveningExtraVnd + item.weekendMinutes * rate.weekendExtraVnd) / 60,
  ) + rate.perLessonVnd;
  return { ...item, payVnd };
}

export function priceLesson(slot: TeachingSlot & { teacherId: string }, rates: Rate[]) {
  const rate = resolveRate(rates, slot.teacherId, slot.startsAt);
  if (!rate) return { ...classifyTeaching(slot), payVnd: null };
  return lessonPay(slot, rate);
}

export function summarizeTeaching(slots: (TeachingSlot & { teacherId: string })[], rates: Rate[] = []) {
  return slots.reduce(
    (total, slot) => {
      const item = priceLesson(slot, rates);
      return {
        lessons: total.lessons + 1,
        minutes: total.minutes + item.minutes,
        eveningMinutes: total.eveningMinutes + item.eveningMinutes,
        weekendMinutes: total.weekendMinutes + item.weekendMinutes,
        payVnd: total.payVnd + (item.payVnd ?? 0),
        unpricedLessons: total.unpricedLessons + (item.payVnd === null ? 1 : 0),
      };
    },
    { lessons: 0, minutes: 0, eveningMinutes: 0, weekendMinutes: 0, payVnd: 0, unpricedLessons: 0 },
  );
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatHours(minutes: number) {
  return `${(minutes / 60).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ`;
}
