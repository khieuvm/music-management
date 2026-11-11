export const studentStatusLabels = { ACTIVE: "Đang học", PAUSED: "Bảo lưu", STOPPED: "Đã nghỉ" } as const;
export const teacherStatusLabels = { ACTIVE: "Đang dạy", INACTIVE: "Ngừng dạy" } as const;
export const classStatusLabels = { PLANNED: "Sắp mở", ACTIVE: "Đang học", FINISHED: "Đã kết thúc", CANCELLED: "Đã hủy" } as const;
export const enrollmentStatusLabels = { ACTIVE: "Đang học", WITHDRAWN: "Đã rút", COMPLETED: "Hoàn thành" } as const;
export const lessonStatusLabels = { SCHEDULED: "Chưa điểm danh", COMPLETED: "Đã dạy", CANCELLED: "Đã hủy" } as const;
export const attendanceLabels = { PRESENT: "Có mặt", LATE: "Đi muộn", EXCUSED: "Vắng có phép", ABSENT: "Vắng" } as const;
export const submissionStatusLabels = { SUBMITTED: "Chờ chấm", NEEDS_REVISION: "Cần làm lại", REVIEWED: "Đã chấm" } as const;
export const paymentMethodLabels = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản" } as const;
export const consultationStatusLabels = { NEW: "Mới", CONTACTING: "Đang liên hệ", ENROLLED: "Đã ghi danh", CLOSED: "Đã đóng" } as const;
export const publicationLabels = { DRAFT: "Bản nháp", PUBLISHED: "Đang hiển thị", ARCHIVED: "Lưu trữ" } as const;

export type Tone = "default" | "good" | "warn" | "alert" | "bad";

export const classStatusTone: Record<keyof typeof classStatusLabels, Tone> = { PLANNED: "warn", ACTIVE: "good", FINISHED: "default", CANCELLED: "bad" };
export const lessonTone: Record<keyof typeof lessonStatusLabels, Tone> = { SCHEDULED: "warn", COMPLETED: "good", CANCELLED: "bad" };
export const attendanceTone: Record<keyof typeof attendanceLabels, Tone> = { PRESENT: "good", LATE: "warn", EXCUSED: "default", ABSENT: "bad" };
export const submissionTone: Record<keyof typeof submissionStatusLabels, Tone> = { SUBMITTED: "warn", NEEDS_REVISION: "bad", REVIEWED: "good" };
