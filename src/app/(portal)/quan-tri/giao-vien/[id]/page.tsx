import Link from "next/link";
import { notFound } from "next/navigation";
import { createTeacherAccountAction, updateTeacherAction } from "@/app/actions/manage";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty } from "@/components/fields";
import { AccountPanel } from "@/components/portal/account-panel";
import { LessonTable } from "@/components/portal/lesson-table";
import { TeacherFields } from "@/components/portal/person-forms";
import { getDb } from "@/lib/db";
import { classStatusLabels } from "@/lib/labels";
import { isUuid } from "@/lib/page";
import { startOfLocalDay } from "@/lib/time";

export default async function TeacherDetailPage({ params }: PageProps<"/quan-tri/giao-vien/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = getDb();
  const teacher = await db.teacher.findUnique({
    where: { id },
    include: { user: true, classes: { orderBy: { startDate: "desc" }, take: 50 } },
  });
  if (!teacher) notFound();
  const lessons = await db.lesson.findMany({
    where: { teacherId: id, startsAt: { gte: startOfLocalDay() }, status: { not: "CANCELLED" } },
    include: { classGroup: { select: { code: true, name: true, location: true, meetingUrl: true } } },
    orderBy: { startsAt: "asc" },
    take: 20,
  });
  return (
    <>
      <div className="page-head">
        <p><Link href="/quan-tri/giao-vien">← Giáo viên</Link></p>
        <h1>{teacher.fullName}</h1>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Thông tin</h2>
          <ActionForm action={updateTeacherAction} submitLabel="Lưu thay đổi">
            <input type="hidden" name="id" value={teacher.id} />
            <TeacherFields teacher={teacher} />
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Tài khoản giáo viên</h2>
          <AccountPanel ownerId={teacher.id} user={teacher.user} createAction={createTeacherAccountAction} usernameRequired />
          <h2>Lớp phụ trách</h2>
          {!teacher.classes.length ? <Empty>Chưa phụ trách lớp nào.</Empty> : (
            <ul className="plain-list">
              {teacher.classes.map((item) => (
                <li key={item.id}><Link href={`/quan-tri/lop/${item.id}`}>{item.name}</Link> <span className="muted">{item.code}</span> <Badge>{classStatusLabels[item.status]}</Badge></li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Lịch dạy sắp tới</h2>
        <LessonTable lessons={lessons} hrefFor={(lessonId) => `/quan-tri/buoi/${lessonId}`} />
      </section>
    </>
  );
}
