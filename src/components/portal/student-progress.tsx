import Link from "next/link";
import { addStudentNoteAction, deleteStudentNoteAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, TextArea } from "@/components/fields";
import { attendanceLabels, attendanceTone, submissionStatusLabels, submissionTone } from "@/lib/labels";
import { getStudentInClass, summarizeAttendance } from "@/lib/services/student-notes";
import { formatDate, formatDateTime } from "@/lib/time";

type Data = Awaited<ReturnType<typeof getStudentInClass>>;

export function StudentProgress({ data, userId, manager, lessonHref, assignmentHref }: {
  data: Data;
  userId: string;
  manager: boolean;
  lessonHref: (lessonId: string) => string;
  assignmentHref: (assignmentId: string) => string;
}) {
  const { student, classGroup, enrollment, lessons, assignments, notes, absences } = data;
  const summary = summarizeAttendance(lessons.flatMap((lesson) => lesson.attendance.map((item) => item.status)));
  const submitted = assignments.filter((item) => item.submissions.length).length;
  return (
    <>
      <div className="page-head">
        <h1>{student.fullName} <span className="muted">{student.code}</span></h1>
        <p className="muted">{classGroup.name} · ghi danh {formatDate(enrollment.enrolledAt)}{enrollment.status !== "ACTIVE" ? " · đã rời lớp" : ""}</p>
      </div>
      <div className="stat-grid">
        <div className="stat"><strong>{summary.attended}/{summary.recorded}</strong><span>Buổi có mặt</span></div>
        <div className="stat"><strong>{summary.excused}</strong><span>Vắng có phép</span></div>
        <div className="stat"><strong>{summary.absent}</strong><span>Vắng không phép</span></div>
        <div className="stat"><strong>{submitted}/{assignments.length}</strong><span>Bài tập đã nộp</span></div>
      </div>

      <section className="panel">
        <h2>Nhận xét về học sinh</h2>
        <ActionForm action={addStudentNoteAction} submitLabel="Lưu nhận xét" resetOnSuccess>
          <input type="hidden" name="classId" value={classGroup.id} />
          <input type="hidden" name="studentId" value={student.id} />
          <TextArea label="Nhận xét" name="content" required minLength={2} maxLength={2000} rows={4}
            placeholder="Tiến bộ, điểm mạnh, điều cần luyện thêm…" />
          <label className="choice"><input type="checkbox" name="shared" defaultChecked /> Cho học sinh / phụ huynh xem</label>
        </ActionForm>
        {!notes.length ? <Empty>Chưa có nhận xét nào.</Empty> : (
          <ul className="note-list">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="note-meta">
                  {formatDateTime(note.createdAt)} · {note.author.displayName}{" "}
                  {note.shared ? <Badge tone="good">Phụ huynh xem được</Badge> : <Badge>Nội bộ</Badge>}
                </p>
                <p className="pre-line">{note.content}</p>
                {(manager || note.authorId === userId) && (
                  <ActionForm action={deleteStudentNoteAction} submitLabel="Xóa" danger confirmMessage="Xóa nhận xét này?" className="mini-form">
                    <input type="hidden" name="noteId" value={note.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Bài tập</h2>
        {!assignments.length ? <Empty>Lớp chưa có bài tập.</Empty> : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead><tr><th>Bài tập</th><th>Hạn</th><th>Bài nộp gần nhất</th><th>Điểm</th></tr></thead>
              <tbody>
                {assignments.map((item) => {
                  const latest = item.submissions[0];
                  return (
                    <tr key={item.id}>
                      <td data-label="Bài tập"><Link href={assignmentHref(item.id)}>{item.title}</Link></td>
                      <td data-label="Hạn">{item.dueAt ? formatDateTime(item.dueAt) : "—"}</td>
                      <td data-label="Bài nộp">
                        {latest ? <>
                          <Badge tone={submissionTone[latest.status]}>{submissionStatusLabels[latest.status]}</Badge>{" "}
                          <span className="muted">lần {latest.attempt} · {formatDateTime(latest.submittedAt)}{latest.videoFile ? " · có video" : ""}</span>
                        </> : <Badge tone={item.dueAt && item.dueAt < new Date() ? "bad" : "default"}>Chưa nộp</Badge>}
                      </td>
                      <td data-label="Điểm">{latest?.score ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Điểm danh</h2>
        {!lessons.length ? <Empty>Chưa có buổi nào.</Empty> : (
          <div className="table-wrap">
            <table className="stack-table">
              <thead><tr><th>Buổi</th><th>Điểm danh</th><th>Nhận xét buổi học</th></tr></thead>
              <tbody>
                {lessons.map((lesson) => {
                  const record = lesson.attendance[0];
                  return (
                    <tr key={lesson.id}>
                      <td data-label="Buổi"><Link href={lessonHref(lesson.id)}>{formatDateTime(lesson.startsAt)}</Link></td>
                      <td data-label="Điểm danh">{record ? <Badge tone={attendanceTone[record.status]}>{attendanceLabels[record.status]}</Badge> : <span className="muted">Chưa điểm danh</span>}</td>
                      <td data-label="Nhận xét">{record?.comment}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {absences.length > 0 && (
        <section className="panel">
          <h2>Đơn xin nghỉ</h2>
          <ul className="plain-list">
            {absences.map((item) => (
              <li key={item.id}>
                <Link href={lessonHref(item.lesson.id)}>{formatDateTime(item.lesson.startsAt)}</Link>: {item.reason}{" "}
                {item.status === "CANCELLED" ? <Badge>Đã rút</Badge> : item.status === "PENDING" ? <Badge tone="warn">Mới</Badge> : <Badge tone="good">Đã xem</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
