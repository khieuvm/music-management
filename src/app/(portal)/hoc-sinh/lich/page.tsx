import { cancelAbsenceAction, requestAbsenceAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field } from "@/components/fields";
import { getDb } from "@/lib/db";
import { attendanceLabels, attendanceTone, lessonStatusLabels, lessonTone } from "@/lib/labels";
import { requireStudent } from "@/lib/student";
import { studentLessons } from "@/lib/student-data";
import { addDays, formatDateTime, formatTime, localDateKey, startOfLocalDay } from "@/lib/time";

export const metadata = { title: "Lịch học & điểm danh" };

export default async function StudentSchedulePage() {
  const { studentId } = await requireStudent();
  const db = getDb();
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    studentLessons(db, studentId, { from: now, to: startOfLocalDay(addDays(localDateKey(now), 60)) }),
    studentLessons(db, studentId, { to: now, order: "desc", take: 60 }),
  ]);
  return (
    <>
      <div className="page-head"><h1>Lịch học & điểm danh</h1></div>
      <section className="panel">
        <h2>Sắp tới</h2>
        {!upcoming.length ? <Empty>Chưa có lịch học sắp tới.</Empty> : (
          <ul className="lesson-list">
            {upcoming.map((lesson) => (
              <li key={lesson.id}>
                <strong>{formatDateTime(lesson.startsAt)}–{formatTime(lesson.endsAt)}</strong> · {lesson.classGroup.name}
                <br />
                <span className="muted">GV {lesson.teacher.fullName} · {lesson.classGroup.meetingUrl
                  ? <a href={lesson.classGroup.meetingUrl} target="_blank" rel="noreferrer">Vào lớp online</a>
                  : lesson.classGroup.location || "Tại trung tâm"}</span>
                {lesson.status === "CANCELLED" && <> <Badge tone="bad">Nghỉ{lesson.cancelReason ? `: ${lesson.cancelReason}` : ""}</Badge></>}
                {lesson.status === "SCHEDULED" && (lesson.absences[0] ? (
                  <div className="absence-box">
                    <Badge tone="warn">{lesson.absences[0].status === "ACKNOWLEDGED" ? "Đã xin nghỉ · giáo viên đã xem" : "Đã xin nghỉ"}</Badge>
                    <span className="muted"> {lesson.absences[0].reason}</span>
                    <ActionForm action={cancelAbsenceAction} submitLabel="Rút đơn" confirmMessage="Rút đơn xin nghỉ cho buổi này?">
                      <input type="hidden" name="requestId" value={lesson.absences[0].id} />
                    </ActionForm>
                  </div>
                ) : (
                  <details className="absence-box">
                    <summary>Xin nghỉ buổi này</summary>
                    <ActionForm action={requestAbsenceAction} submitLabel="Gửi đơn xin nghỉ">
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <Field label="Lý do" name="reason" id={`reason-${lesson.id}`} required minLength={2} maxLength={500} placeholder="Ví dụ: Bé bị ốm, gia đình đi xa…" />
                    </ActionForm>
                  </details>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Đã học</h2>
        {!past.length ? <Empty>Chưa có buổi nào.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Buổi</th><th>Lớp</th><th>Nội dung</th><th>Điểm danh</th><th>Nhận xét của giáo viên</th></tr></thead>
              <tbody>
                {past.map((lesson) => {
                  const record = lesson.attendance[0];
                  return (
                    <tr key={lesson.id}>
                      <td>{formatDateTime(lesson.startsAt)}</td>
                      <td>{lesson.classGroup.name}</td>
                      <td>{lesson.topic}</td>
                      <td>{record ? <Badge tone={attendanceTone[record.status]}>{attendanceLabels[record.status]}</Badge>
                        : <Badge tone={lessonTone[lesson.status]}>{lessonStatusLabels[lesson.status]}</Badge>}
                        {lesson.absences[0] && <><br /><span className="muted">Đã xin nghỉ</span></>}</td>
                      <td>{record?.comment}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
