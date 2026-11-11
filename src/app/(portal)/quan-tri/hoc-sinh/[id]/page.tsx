import Link from "next/link";
import { notFound } from "next/navigation";
import { createStudentAccountAction, updateStudentAction, withdrawEnrollmentAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field } from "@/components/fields";
import { AccountPanel } from "@/components/portal/account-panel";
import { FinancePanel } from "@/components/portal/finance-panel";
import { StudentFields } from "@/components/portal/person-forms";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { attendanceLabels, attendanceTone, enrollmentStatusLabels } from "@/lib/labels";
import { isUuid } from "@/lib/page";
import { getEnrollmentFinance } from "@/lib/services/fees";
import { formatDate, formatDateTime } from "@/lib/time";

export default async function StudentDetailPage({ params }: PageProps<"/quan-tri/hoc-sinh/[id]">) {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const student = await db.student.findUnique({
    where: { id },
    include: {
      user: true,
      enrollments: { include: { classGroup: { select: { id: true, code: true, name: true } } }, orderBy: { enrolledAt: "desc" } },
      attendance: { include: { lesson: { include: { classGroup: { select: { code: true } } } } }, orderBy: { lesson: { startsAt: "desc" } }, take: 20 },
      notes: { include: { classGroup: { select: { id: true, name: true } }, author: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!student) notFound();
  const finances = await Promise.all(student.enrollments.map((item) => getEnrollmentFinance(db, item.id)));
  return (
    <>
      <div className="page-head">
        <p><Link href="/quan-tri/hoc-sinh">← Học sinh</Link></p>
        <h1>{student.fullName} <span className="muted">{student.code}</span></h1>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Thông tin</h2>
          <ActionForm action={updateStudentAction} submitLabel="Lưu thay đổi">
            <input type="hidden" name="id" value={student.id} />
            <StudentFields student={student} />
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Tài khoản học sinh / phụ huynh</h2>
          <p className="muted">Học sinh và phụ huynh dùng chung một tài khoản.</p>
          <AccountPanel ownerId={student.id} user={student.user} createAction={createStudentAccountAction} defaultUsername={student.code.toLowerCase()} />
        </section>
      </div>
      <section className="panel">
        <h2>Lớp & học phí</h2>
        {!student.enrollments.length && <Empty>Chưa ghi danh lớp nào. Vào trang lớp để ghi danh.</Empty>}
        {student.enrollments.map((enrollment, index) => (
          <article key={enrollment.id} id={`ghi-danh-${enrollment.id}`} className="sub-panel">
            <div className="row-between">
              <h3><Link href={`/quan-tri/lop/${enrollment.classGroup.id}`}>{enrollment.classGroup.name}</Link> <span className="muted">{enrollment.classGroup.code}</span></h3>
              <Badge tone={enrollment.status === "ACTIVE" ? "good" : "default"}>{enrollmentStatusLabels[enrollment.status]}</Badge>
            </div>
            <p className="muted">Ghi danh {formatDate(enrollment.enrolledAt)}{enrollment.withdrawnAt ? ` · rút ${formatDate(enrollment.withdrawnAt)}` : ""}{enrollment.note ? ` · ${enrollment.note}` : ""}</p>
            {finances[index] && <FinancePanel finance={finances[index]} mode={actor.role === "ADMIN" ? "admin" : "staff"} />}
            {enrollment.status === "ACTIVE" && (
              <details>
                <summary>Rút khỏi lớp</summary>
                <ActionForm action={withdrawEnrollmentAction} submitLabel="Xác nhận rút" danger confirmMessage="Rút học sinh khỏi lớp này?">
                  <input type="hidden" name="enrollmentId" value={enrollment.id} />
                  <Field label="Lý do" name="reason" id={`withdraw-${enrollment.id}`} required maxLength={300} />
                </ActionForm>
              </details>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Nhận xét của giáo viên</h2>
        {!student.notes.length ? <Empty>Chưa có nhận xét. Giáo viên nhận xét ở trang lớp → “Xem & nhận xét”.</Empty> : (
          <ul className="note-list">
            {student.notes.map((note) => (
              <li key={note.id}>
                <p className="note-meta">
                  {formatDateTime(note.createdAt)} · <Link href={`/quan-tri/lop/${note.classGroup.id}/hoc-sinh/${student.id}`}>{note.classGroup.name}</Link> · {note.author.displayName}{" "}
                  {note.shared ? <Badge tone="good">Phụ huynh xem được</Badge> : <Badge>Nội bộ</Badge>}
                </p>
                <p className="pre-line">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Điểm danh gần đây</h2>
        {!student.attendance.length ? <Empty>Chưa có dữ liệu điểm danh.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Buổi</th><th>Lớp</th><th>Điểm danh</th><th>Nhận xét</th></tr></thead>
              <tbody>
                {student.attendance.map((item) => (
                  <tr key={item.id}>
                    <td><Link href={`/quan-tri/buoi/${item.lessonId}`}>{formatDateTime(item.lesson.startsAt)}</Link></td>
                    <td>{item.lesson.classGroup.code}</td>
                    <td><Badge tone={attendanceTone[item.status]}>{attendanceLabels[item.status]}</Badge></td>
                    <td>{item.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
