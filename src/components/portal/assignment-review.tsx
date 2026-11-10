import { reviewSubmissionAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Select, TextArea } from "@/components/fields";
import { submissionStatusLabels, submissionTone } from "@/lib/labels";
import type { getAssignmentForTeacher } from "@/lib/services/assignments";
import { formatDateTime } from "@/lib/time";

type Data = Awaited<ReturnType<typeof getAssignmentForTeacher>>;

function formatSize(bytes: bigint) {
  return `${(Number(bytes) / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

export function AssignmentReview({ data }: { data: Data }) {
  const { assignment, submissions, roster } = data;
  const byStudent = new Map<string, Data["submissions"]>();
  for (const item of submissions) byStudent.set(item.studentId, [...(byStudent.get(item.studentId) ?? []), item]);
  const missing = roster.filter((student) => !byStudent.has(student.id));
  return (
    <>
      <div className="page-head">
        <h1>{assignment.title}</h1>
        <p className="muted">{assignment.classGroup.name} ({assignment.classGroup.code}){assignment.dueAt ? ` · Hạn nộp ${formatDateTime(assignment.dueAt)}` : ""}</p>
        {assignment.instructions && <p className="pre-line">{assignment.instructions}</p>}
      </div>
      {missing.length > 0 && <p className="status">Chưa nộp: {missing.map((student) => student.fullName).join(", ")}</p>}
      {!byStudent.size && <Empty>Chưa có học sinh nào nộp bài.</Empty>}
      <div className="card-list">
        {[...byStudent.values()].map((attempts) => {
          const latest = attempts[0];
          return (
            <article className="panel" key={latest.studentId}>
              <div className="row-between">
                <h2>{latest.student.fullName} <span className="muted">{latest.student.code}</span></h2>
                <Badge tone={submissionTone[latest.status]}>{submissionStatusLabels[latest.status]}</Badge>
              </div>
              <p className="muted">Lần nộp {latest.attempt} · {formatDateTime(latest.submittedAt)}</p>
              {latest.videoFile && (
                <>
                  <video className="video" controls preload="metadata" src={`/api/tep/${latest.videoFile.id}`} />
                  <p className="muted">{latest.videoFile.originalName} · {formatSize(latest.videoFile.sizeBytes)} · <a href={`/api/tep/${latest.videoFile.id}`} target="_blank" rel="noreferrer">Mở riêng</a></p>
                </>
              )}
              {latest.textAnswer && <p className="pre-line">{latest.textAnswer}</p>}
              <ActionForm action={reviewSubmissionAction} submitLabel="Lưu nhận xét">
                <input type="hidden" name="submissionId" value={latest.id} />
                <div className="form-grid">
                  <Select label="Kết quả" name="status" id={`status-${latest.id}`} defaultValue={latest.status === "SUBMITTED" ? "REVIEWED" : latest.status}>
                    <option value="REVIEWED">Đạt – đã chấm</option>
                    <option value="NEEDS_REVISION">Cần làm lại</option>
                  </Select>
                  <Field label="Điểm (0–10, có thể bỏ trống)" name="score" id={`score-${latest.id}`} type="number" min={0} max={10} defaultValue={latest.score ?? ""} />
                </div>
                <TextArea label="Nhận xét cho học sinh" name="feedback" id={`feedback-${latest.id}`} maxLength={2000} defaultValue={latest.feedback} />
              </ActionForm>
              {attempts.length > 1 && (
                <details>
                  <summary>Các lần nộp trước ({attempts.length - 1})</summary>
                  <ul className="plain-list">
                    {attempts.slice(1).map((item) => (
                      <li key={item.id}>
                        Lần {item.attempt} · {formatDateTime(item.submittedAt)} · {submissionStatusLabels[item.status]}
                        {item.videoFile && <> · <a href={`/api/tep/${item.videoFile.id}`} target="_blank" rel="noreferrer">Xem video</a></>}
                        {item.feedback && <><br /><span className="muted">{item.feedback}</span></>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
