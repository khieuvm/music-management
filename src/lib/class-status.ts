import type { Tone } from "@/lib/labels";

export type ClassStatusValue = "PLANNED" | "ACTIVE" | "FINISHED" | "CANCELLED";

/** Allowed manual status changes. PLANNED → ACTIVE also happens automatically once the first lesson starts. */
export const classTransitions: Record<ClassStatusValue, ClassStatusValue[]> = {
  PLANNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["FINISHED", "CANCELLED"],
  FINISHED: ["ACTIVE"],
  CANCELLED: ["PLANNED"],
};

export const classTransitionLabels: Record<string, string> = {
  "PLANNED>ACTIVE": "Bắt đầu lớp",
  "PLANNED>CANCELLED": "Hủy lớp",
  "ACTIVE>FINISHED": "Kết thúc lớp",
  "ACTIVE>CANCELLED": "Hủy lớp",
  "FINISHED>ACTIVE": "Mở lại lớp",
  "CANCELLED>PLANNED": "Khôi phục lớp",
};

export type ClassProgress = {
  totalLessons: number;
  completedLessons: number;
  pendingAttendance: number;
  upcomingLessons: number;
  nextLessonAt: Date | null;
  firstLessonAt: Date | null;
  lastLessonEndsAt: Date | null;
  attendanceMarks: number;
  presentMarks: number;
};

export const emptyProgress: ClassProgress = {
  totalLessons: 0, completedLessons: 0, pendingAttendance: 0, upcomingLessons: 0,
  nextLessonAt: null, firstLessonAt: null, lastLessonEndsAt: null, attendanceMarks: 0, presentMarks: 0,
};

export function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export type ClassFlag = { key: string; label: string; tone: Tone };

/** Things a manager should act on for a class, most important first. */
export function classFlags(input: {
  status: ClassStatusValue; capacity: number; students: number; progress: ClassProgress; overdueVnd: number; now?: Date;
}): ClassFlag[] {
  const { status, progress } = input;
  const now = input.now ?? new Date();
  if (status === "FINISHED" || status === "CANCELLED") return [];
  const flags: ClassFlag[] = [];
  if (progress.pendingAttendance > 0) flags.push({ key: "attendance", label: `${progress.pendingAttendance} buổi chưa điểm danh`, tone: "bad" });
  if (input.overdueVnd > 0) flags.push({ key: "overdue", label: "Có học phí quá hạn", tone: "bad" });
  if (status === "ACTIVE" && progress.totalLessons > 0 && progress.upcomingLessons === 0
    && progress.lastLessonEndsAt && progress.lastLessonEndsAt <= now) {
    flags.push({ key: "finish", label: "Đã học hết lịch — nên kết thúc", tone: "alert" });
  }
  if (progress.totalLessons === 0) flags.push({ key: "schedule", label: "Chưa có lịch học", tone: "warn" });
  if (input.students === 0) flags.push({ key: "empty", label: "Chưa có học sinh", tone: "warn" });
  else if (input.students >= input.capacity) flags.push({ key: "full", label: "Đủ sĩ số", tone: "default" });
  return flags;
}
