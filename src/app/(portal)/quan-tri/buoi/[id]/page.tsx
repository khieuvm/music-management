import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonDetail } from "@/components/portal/lesson-detail";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getLessonForAttendance } from "@/lib/services/attendance";

export default async function ManagerLessonPage({ params }: PageProps<"/quan-tri/buoi/[id]">) {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await orNotFound(getLessonForAttendance(getDb(), actor, id));
  return (
    <>
      <p><Link href={`/quan-tri/lop/${data.lesson.classId}`}>← Về lớp</Link></p>
      <LessonDetail data={data} manager />
    </>
  );
}
