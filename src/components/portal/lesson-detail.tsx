import { acknowledgeAbsenceAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { AttendanceForm } from "@/components/portal/attendance-form";
import { Badge } from "@/components/fields";
import { lessonStatusLabels, lessonTone } from "@/lib/labels";
import type { getLessonForAttendance } from "@/lib/services/attendance";
import { formatDateTime, formatTime } from "@/lib/time";

export function LessonDetail({ data, manager }: { data: Awaited<ReturnType<typeof getLessonForAttendance>>; manager: boolean }) {
  const { lesson, roster } = data;
  const names = new Map(roster.map((student) => [student.id, student.fullName]));
  const group = lesson.classGroup;
  return (
    <>
      <div className="page-head">
        <h1>{group.name} <span className="muted">{group.code}</span></h1>
        <p>
          {formatDateTime(lesson.startsAt)}–{formatTime(lesson.endsAt)} · {lesson.teacher.fullName}{" "}
          <Badge tone={lessonTone[lesson.status]}>{lessonStatusLabels[lesson.status]}</Badge>
        </p>
        <p className="muted">
          {group.course.title} · {group.meetingUrl ? <a href={group.meetingUrl} target="_blank" rel="noreferrer">Link lớp online</a> : group.location || "Chưa có phòng"}
        </p>
      </div>
      {lesson.absences.length > 0 && (
        <section className="panel">
          <h2>Đơn xin nghỉ ({lesson.absences.length})</h2>
          <ul className="plain-list">
            {lesson.absences.map((item) => (
              <li key={item.id}>
                <strong>{names.get(item.studentId) ?? "Học sinh"}</strong>: {item.reason}{" "}
                <span className="muted">· gửi {formatDateTime(item.createdAt)}</span>{" "}
                {item.status === "PENDING" && lesson.status === "SCHEDULED" ? (
                  <ActionForm action={acknowledgeAbsenceAction} submitLabel="Đã biết" className="mini-form">
                    <input type="hidden" name="requestId" value={item.id} />
                  </ActionForm>
                ) : <Badge tone="good">Đã xem</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel">
        <h2>Điểm danh & nhận xét</h2>
        <AttendanceForm data={data} manager={manager} />
      </section>
    </>
  );
}
