import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentProgress } from "@/components/portal/student-progress";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getStudentInClass } from "@/lib/services/student-notes";
import { requireTeacher } from "@/lib/teacher";

export const metadata = { title: "Tiến độ học sinh" };

export default async function TeacherStudentPage({ params }: PageProps<"/giao-vien/lop/[id]/hoc-sinh/[studentId]">) {
  const { actor } = await requireTeacher();
  const { id, studentId } = await params;
  if (!isUuid(id) || !isUuid(studentId)) notFound();
  const data = await orNotFound(getStudentInClass(getDb(), actor, id, studentId));
  return (
    <>
      <p><Link href={`/giao-vien/lop/${id}`}>← {data.classGroup.name}</Link></p>
      <StudentProgress
        data={data} userId={actor.userId} manager={false}
        lessonHref={(lessonId) => `/giao-vien/buoi/${lessonId}`}
        assignmentHref={(assignmentId) => `/giao-vien/bai-tap/${assignmentId}`}
      />
    </>
  );
}
