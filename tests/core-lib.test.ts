import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "../src/lib/auth/password";
import { allocatePayments, installmentStateText, splitInstallments, worstState } from "../src/lib/fees";
import { classifyTeaching, lessonPay, resolveRate, summarizeTeaching, type Rate } from "../src/lib/payroll";
import { generateOccurrences, overlaps } from "../src/lib/schedule";
import { addMonths, isDateString, localDateKey, localDateTime } from "../src/lib/time";
import { detectVideoType } from "../src/lib/video";

const at = (date: string, time: string) => localDateTime(date, time);

describe("Vietnam local time", () => {
  it("converts local wall time to the right instant and back", () => {
    expect(at("2026-03-01", "07:30").toISOString()).toBe("2026-03-01T00:30:00.000Z");
    expect(localDateKey(new Date("2026-03-01T17:30:00Z"))).toBe("2026-03-02");
  });

  it("rejects impossible dates and clamps month ends", () => {
    expect(isDateString("2026-02-30")).toBe(false);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("weekly lesson generation", () => {
  it("creates lessons only on selected weekdays", () => {
    // 2026-03-02 is a Monday.
    const lessons = generateOccurrences({ fromDate: "2026-03-02", toDate: "2026-03-15", weekdays: [2, 4], startTime: "18:00", durationMinutes: 90 });
    expect(lessons.map((item) => localDateKey(item.startsAt))).toEqual(["2026-03-03", "2026-03-05", "2026-03-10", "2026-03-12"]);
    expect(lessons[0].endsAt.getTime() - lessons[0].startsAt.getTime()).toBe(90 * 60_000);
  });

  it("refuses invalid patterns and runaway ranges", () => {
    const base = { fromDate: "2026-03-02", toDate: "2026-03-15", weekdays: [1], startTime: "18:00", durationMinutes: 60 };
    expect(() => generateOccurrences({ ...base, weekdays: [] })).toThrow(RangeError);
    expect(() => generateOccurrences({ ...base, durationMinutes: 5 })).toThrow(RangeError);
    expect(() => generateOccurrences({ ...base, toDate: "2026-03-01" })).toThrow(RangeError);
    expect(() => generateOccurrences({ ...base, toDate: "2030-12-31", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toThrow(/tối đa/);
  });

  it("treats touching lessons as not overlapping", () => {
    const a = { startsAt: at("2026-03-03", "18:00"), endsAt: at("2026-03-03", "19:00") };
    expect(overlaps(a, { startsAt: at("2026-03-03", "19:00"), endsAt: at("2026-03-03", "20:00") })).toBe(false);
    expect(overlaps(a, { startsAt: at("2026-03-03", "18:30"), endsAt: at("2026-03-03", "19:30") })).toBe(true);
  });
});

describe("teaching time for payroll", () => {
  it("splits evening minutes from 18:00 local time", () => {
    expect(classifyTeaching({ startsAt: at("2026-03-03", "17:00"), endsAt: at("2026-03-03", "19:00") }))
      .toEqual({ minutes: 120, eveningMinutes: 60, weekendMinutes: 0 });
  });

  it("counts Saturday and Sunday as weekend, including evenings", () => {
    const summary = summarizeTeaching([
      { teacherId: "t", startsAt: at("2026-03-07", "08:30"), endsAt: at("2026-03-07", "10:00") },
      { teacherId: "t", startsAt: at("2026-03-08", "18:00"), endsAt: at("2026-03-08", "19:00") },
    ]);
    expect(summary).toEqual({ lessons: 2, minutes: 150, eveningMinutes: 60, weekendMinutes: 150, payVnd: 0, unpricedLessons: 2 });
  });

  const rate = (teacherId: string | null, from: string, hourlyVnd: number, extra: Partial<Rate> = {}): Rate => ({
    teacherId, effectiveFrom: new Date(`${from}T00:00:00Z`), hourlyVnd,
    eveningExtraVnd: 0, weekendExtraVnd: 0, perLessonVnd: 0, eveningStartMinutes: 18 * 60, ...extra,
  });

  it("picks the teacher's own rate before the default, by effective date", () => {
    const rates = [rate(null, "2026-01-01", 100_000), rate(null, "2026-03-01", 120_000), rate("t1", "2026-03-05", 200_000)];
    expect(resolveRate(rates, "t1", at("2026-03-04", "09:00"))?.hourlyVnd).toBe(120_000);
    expect(resolveRate(rates, "t1", at("2026-03-05", "00:30"))?.hourlyVnd).toBe(200_000);
    expect(resolveRate(rates, "t2", at("2026-02-10", "09:00"))?.hourlyVnd).toBe(100_000);
    expect(resolveRate(rates, "t2", at("2025-12-31", "23:00"))).toBeNull();
  });

  it("adds evening and weekend extras per hour plus a per-lesson allowance", () => {
    const r = rate(null, "2026-01-01", 150_000, { eveningExtraVnd: 30_000, weekendExtraVnd: 20_000, perLessonVnd: 10_000, eveningStartMinutes: 17 * 60 + 30 });
    // Saturday 17:00–19:00: 2h base, 1.5h evening (from 17:30), 2h weekend.
    expect(lessonPay({ startsAt: at("2026-03-07", "17:00"), endsAt: at("2026-03-07", "19:00") }, r))
      .toMatchObject({ minutes: 120, eveningMinutes: 90, weekendMinutes: 120, payVnd: 300_000 + 45_000 + 40_000 + 10_000 });
  });
});

describe("tuition installments", () => {
  it("rounds to 1,000 VND and keeps the exact total", () => {
    const plan = splitInstallments(2_500_500, 3, "2026-01-31");
    expect(plan.map((item) => item.amountVnd)).toEqual([833_000, 833_000, 834_500]);
    expect(plan.reduce((sum, item) => sum + item.amountVnd, 0)).toBe(2_500_500);
    expect(plan.map((item) => item.dueDate.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(() => splitInstallments(1_000_000, 0, "2026-01-01")).toThrow(RangeError);
  });

  it("applies payments to the earliest installment first", () => {
    const plan = splitInstallments(3_000_000, 3, "2026-01-10");
    const states = allocatePayments(plan, 1_500_000, new Date("2026-02-15T00:00:00Z"));
    expect(states.map((item) => [item.state, item.outstandingVnd])).toEqual([
      ["PAID", 0], ["OVERDUE", 500_000], ["UPCOMING", 1_000_000],
    ]);
    const early = allocatePayments(plan, 1_500_000, new Date("2026-01-01T00:00:00Z"))[1];
    expect([early.state, early.partial]).toEqual(["UPCOMING", true]);
  });

  it("colours unpaid installments by days until due", () => {
    const plan = [
      { dueDate: new Date("2026-03-01T00:00:00Z"), amountVnd: 100 },
      { dueDate: new Date("2026-03-10T00:00:00Z"), amountVnd: 100 },
      { dueDate: new Date("2026-03-17T00:00:00Z"), amountVnd: 100 },
      { dueDate: new Date("2026-03-18T00:00:00Z"), amountVnd: 100 },
    ];
    const items = allocatePayments(plan, 0, new Date("2026-03-10T00:00:00Z"));
    expect(items.map((item) => [item.state, item.daysUntilDue])).toEqual([
      ["OVERDUE", -9], ["DUE_TODAY", 0], ["DUE_SOON", 7], ["UPCOMING", 8],
    ]);
    expect(installmentStateText(items[0])).toBe("Quá hạn 9 ngày");
    expect(installmentStateText(items[2])).toBe("Còn 7 ngày");
    expect(worstState(items)).toBe("OVERDUE");
    expect(worstState(allocatePayments(plan, 400, new Date("2026-03-10T00:00:00Z")))).toBe("PAID");
  });
});

describe("video signature detection", () => {
  const ftyp = (brand: string) => Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from(`ftyp${brand}`)]);

  it("recognises MP4, MOV and WebM by content", () => {
    expect(detectVideoType(ftyp("isom"))).toBe("video/mp4");
    expect(detectVideoType(ftyp("qt  "))).toBe("video/quicktime");
    expect(detectVideoType(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("video/webm");
  });

  it("rejects photos and other files even if named .mp4", () => {
    expect(detectVideoType(ftyp("heic"))).toBeNull();
    expect(detectVideoType(Buffer.from("plain text file"))).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies only the original password", async () => {
    const stored = await hashPassword("mat-khau-dai-123");
    expect(stored).not.toContain("mat-khau-dai-123");
    await expect(verifyPassword("mat-khau-dai-123", stored)).resolves.toBe(true);
    await expect(verifyPassword("mat-khau-dai-124", stored)).resolves.toBe(false);
  });

  it("generates unambiguous temporary passwords", () => {
    const value = generateTemporaryPassword();
    expect(value).toHaveLength(10);
    expect(new Set(Array.from({ length: 20 }, () => generateTemporaryPassword())).size).toBe(20);
  });
});
