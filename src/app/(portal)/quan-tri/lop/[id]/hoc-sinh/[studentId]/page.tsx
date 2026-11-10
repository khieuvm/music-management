import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentProgress } from "@/components/portal/student-progress";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getStudentInClass } from "@/lib/services/student-notes";

export const metadata = { title: "Tiến độ học sinh" };

export default async function ManagerStudentProgressPage({ params }: PageProps<"/quan-tri/lop/[id]/hoc-sinh/[studentId]">) {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const { id, studentId } = await params;
  if (!isUuid(id) || !isUuid(studentId)) notFound();
  const data = await orNotFound(getStudentInClass(getDb(), actor, id, studentId));
  return (
    <>
      <p><Link href={`/quan-tri/lop/${id}`}>← {data.classGroup.name}</Link> · <Link href={`/quan-tri/hoc-sinh/${studentId}`}>Hồ sơ học sinh</Link></p>
      <StudentProgress
        data={data} userId={actor.userId} manager
        lessonHref={(lessonId) => `/quan-tri/buoi/${lessonId}`}
        assignmentHref={(assignmentId) => `/quan-tri/bai-tap/${assignmentId}`}
      />
    </>
  );
}
