import Link from "next/link";
import { notFound } from "next/navigation";
import { submitAssignmentAction } from "@/app/actions/teaching";
import { Badge } from "@/components/fields";
import { SubmissionForm } from "@/components/portal/submission-form";
import { getDb } from "@/lib/db";
import { submissionStatusLabels, submissionTone } from "@/lib/labels";
import { isUuid, orNotFound } from "@/lib/page";
import { getAssignmentForStudent } from "@/lib/services/assignments";
import { requireStudent } from "@/lib/student";
import { formatDateTime } from "@/lib/time";
import { maxUploadBytes } from "@/lib/video";

export default async function StudentAssignmentPage({ params }: PageProps<"/hoc-sinh/bai-tap/[id]">) {
  const { actor } = await requireStudent();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { assignment, submissions, canSubmit } = await orNotFound(getAssignmentForStudent(getDb(), actor, id));
  const latest = submissions[0];
  return (
    <>
      <p><Link href="/hoc-sinh/bai-tap">← Bài tập</Link></p>
      <div className="page-head">
        <h1>{assignment.title}</h1>
        <p className="muted">{assignment.classGroup.name}{assignment.dueAt ? ` · Hạn nộp ${formatDateTime(assignment.dueAt)}` : ""}</p>
      </div>
      {assignment.instructions && <section className="panel"><h2>Hướng dẫn</h2><p className="pre-line">{assignment.instructions}</p></section>}
      {latest && (
        <section className="panel">
          <div className="row-between">
            <h2>Bài đã nộp (lần {latest.attempt})</h2>
            <Badge tone={submissionTone[latest.status]}>{submissionStatusLabels[latest.status]}</Badge>
          </div>
          <p className="muted">Nộp lúc {formatDateTime(latest.submittedAt)}</p>
          {latest.videoFile && <video className="video" controls preload="metadata" src={`/api/tep/${latest.videoFile.id}`} />}
          {latest.textAnswer && <p className="pre-line">{latest.textAnswer}</p>}
          {(latest.feedback || latest.score !== null) && (
            <div className="feedback">
              <strong>Nhận xét của giáo viên{latest.score !== null ? ` · ${latest.score}/10` : ""}</strong>
              {latest.feedback && <p className="pre-line">{latest.feedback}</p>}
            </div>
          )}
        </section>
      )}
      {canSubmit ? (
        <section className="panel">
          <h2>{latest ? "Nộp lại" : "Nộp bài"}</h2>
          {latest?.status === "SUBMITTED" && <p className="muted">Bạn có thể nộp lại trước khi giáo viên chấm; giáo viên sẽ xem lần nộp mới nhất.</p>}
          <SubmissionForm assignmentId={assignment.id} requireVideo={assignment.requireVideo} maxMb={Math.floor(maxUploadBytes() / 1024 / 1024)} action={submitAssignmentAction} />
        </section>
      ) : latest?.status !== "REVIEWED" && <p className="status">Bài tập này hiện không nhận bài nộp.</p>}
      {submissions.length > 1 && (
        <details className="panel">
          <summary>Các lần nộp trước</summary>
          <ul className="plain-list">
            {submissions.slice(1).map((item) => (
              <li key={item.id}>Lần {item.attempt} · {formatDateTime(item.submittedAt)} · {submissionStatusLabels[item.status]}{item.feedback && <><br /><span className="muted">{item.feedback}</span></>}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
