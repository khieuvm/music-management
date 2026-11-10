import { saveAttendanceAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Empty, Field, TextArea } from "@/components/fields";
import type { getLessonForAttendance } from "@/lib/services/attendance";
import { teacherEditDeadline } from "@/lib/services/attendance";
import { attendanceLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";

type Data = Awaited<ReturnType<typeof getLessonForAttendance>>;

export function AttendanceForm({ data, manager }: { data: Data; manager: boolean }) {
  const { lesson, roster } = data;
  const now = new Date();
  if (lesson.status === "CANCELLED") return <p className="status error">Buổi học đã hủy{lesson.cancelReason ? `: ${lesson.cancelReason}` : ""}.</p>;
  if (lesson.startsAt > now) return <p className="status">Chỉ điểm danh được khi buổi học đã bắt đầu ({formatDateTime(lesson.startsAt)}).</p>;
  const deadline = teacherEditDeadline(lesson);
  const overdue = now > deadline;
  if (overdue && !manager) {
    return <p className="status error">Đã quá hạn sửa điểm danh ({formatDateTime(deadline)}). Vui lòng liên hệ giáo vụ nếu cần điều chỉnh.</p>;
  }
  if (!roster.length) return <Empty>Không có học sinh nào trong lớp ở thời điểm buổi học.</Empty>;
  const existing = new Map(lesson.attendance.map((item) => [item.studentId, item]));
  const absences = new Map(lesson.absences.map((item) => [item.studentId, item]));
  return (
    <ActionForm action={saveAttendanceAction} submitLabel={lesson.status === "COMPLETED" ? "Cập nhật điểm danh" : "Lưu điểm danh & xác nhận đã dạy"}>
      <input type="hidden" name="lessonId" value={lesson.id} />
      <p className="muted">Lưu điểm danh cũng xác nhận buổi này đã dạy — dữ liệu dùng để tính giờ dạy/lương. Giáo viên sửa được trong {formatDateTime(deadline)}.</p>
      <div className="attendance-list">
        {roster.map((student) => {
          const current = existing.get(student.id);
          const absence = absences.get(student.id);
          return (
            <fieldset className="attendance-row" key={student.id}>
              <legend><strong>{student.fullName}</strong> <span className="muted">{student.code}</span></legend>
              {absence && <p className="absence-note">Đã xin nghỉ: {absence.reason}</p>}
              <input type="hidden" name="studentId" value={student.id} />
              <div className="choice-row">
                {Object.entries(attendanceLabels).map(([value, label]) => (
                  <label key={value} className="choice">
                    <input type="radio" name={`status_${student.id}`} value={value} defaultChecked={(current?.status ?? (absence ? "EXCUSED" : "PRESENT")) === value} required />
                    {label}
                  </label>
                ))}
              </div>
              <Field label="Nhận xét cho học sinh / phụ huynh" name={`comment_${student.id}`} id={`comment_${student.id}`} defaultValue={current?.comment ?? ""} maxLength={1000} />
            </fieldset>
          );
        })}
      </div>
      <Field label="Nội dung buổi học" name="topic" defaultValue={lesson.topic} maxLength={300} placeholder="Ví dụ: Gam Đô trưởng, bài Für Elise đoạn 1" />
      <TextArea label="Ghi chú nội bộ (giáo vụ xem)" name="teacherNote" defaultValue={lesson.teacherNote} maxLength={1000} />
      {overdue && manager && <Field label="Lý do sửa sau hạn" name="overrideReason" required maxLength={300} />}
    </ActionForm>
  );
}
