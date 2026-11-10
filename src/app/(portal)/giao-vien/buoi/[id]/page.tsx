import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonDetail } from "@/components/portal/lesson-detail";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getLessonForAttendance } from "@/lib/services/attendance";
import { requireTeacher } from "@/lib/teacher";

export default async function TeacherLessonPage({ params }: PageProps<"/giao-vien/buoi/[id]">) {
  const { actor } = await requireTeacher();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await orNotFound(getLessonForAttendance(getDb(), actor, id));
  return (
    <>
      <p><Link href="/giao-vien">← Lịch dạy</Link></p>
      <LessonDetail data={data} manager={false} />
    </>
  );
}
