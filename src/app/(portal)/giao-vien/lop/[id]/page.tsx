import Link from "next/link";
import { notFound } from "next/navigation";
import { createAssignmentAction } from "@/app/actions/teaching";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { AssignmentFields } from "@/components/portal/assignment-fields";
import { ClassRoster } from "@/components/portal/class-roster";
import { LessonTable } from "@/components/portal/lesson-table";
import { getDb } from "@/lib/db";
import { isUuid } from "@/lib/page";
import { classProgress } from "@/lib/services/student-notes";
import { requireTeacher } from "@/lib/teacher";
import { formatDateTime } from "@/lib/time";

export default async function TeacherClassPage({ params }: PageProps<"/giao-vien/lop/[id]">) {
  const { teacherId } = await requireTeacher();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const classGroup = await db.classGroup.findFirst({
    where: { id, teacherId },
    include: {
      enrollments: { where: { status: "ACTIVE" }, include: { student: { select: { id: true, code: true, fullName: true } } }, orderBy: { student: { fullName: "asc" } } },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } },
      },
      lessons: { orderBy: { startsAt: "asc" }, include: { teacher: { select: { fullName: true } } } },
    },
  });
  if (!classGroup) notFound();
  const progress = await classProgress(db, classGroup.id);
  const open = classGroup.status === "PLANNED" || classGroup.status === "ACTIVE";
  const lessons = classGroup.lessons.map((lesson) => ({ ...lesson, classGroup }));
  return (
    <>
      <p><Link href="/giao-vien/lop">← Lớp phụ trách</Link></p>
      <div className="page-head"><h1>{classGroup.name} <span className="muted">{classGroup.code}</span></h1></div>
      <section className="panel">
        <h2>Học sinh ({classGroup.enrollments.length})</h2>
        <ClassRoster
          students={classGroup.enrollments.map((item) => item.student)}
          progress={progress}
          hrefFor={(studentId) => `/giao-vien/lop/${classGroup.id}/hoc-sinh/${studentId}`}
        />
      </section>
      <section className="panel">
        <h2>Bài tập</h2>
        {!classGroup.assignments.length ? <Empty>Chưa giao bài tập.</Empty> : (
          <ul className="plain-list">
            {classGroup.assignments.map((item) => (
              <li key={item.id}>
                <Link href={`/giao-vien/bai-tap/${item.id}`}>{item.title}</Link>{" "}
                {item._count.submissions > 0 && <Badge tone="warn">{item._count.submissions} chờ chấm</Badge>}
                {item.dueAt && <span className="muted"> · hạn {formatDateTime(item.dueAt)}</span>}
              </li>
            ))}
          </ul>
        )}
        {open && (
          <details>
            <summary>+ Giao bài tập mới</summary>
            <ActionForm action={createAssignmentAction} submitLabel="Giao bài" resetOnSuccess>
              <input type="hidden" name="classId" value={classGroup.id} />
              <AssignmentFields />
            </ActionForm>
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Lịch học của lớp</h2>
        <LessonTable lessons={lessons} hrefFor={(lessonId) => `/giao-vien/buoi/${lessonId}`} />
      </section>
    </>
  );
}
