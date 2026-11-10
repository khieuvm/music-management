import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentReview } from "@/components/portal/assignment-review";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getAssignmentForTeacher } from "@/lib/services/assignments";
import { requireTeacher } from "@/lib/teacher";

export default async function TeacherAssignmentPage({ params }: PageProps<"/giao-vien/bai-tap/[id]">) {
  const { actor } = await requireTeacher();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await orNotFound(getAssignmentForTeacher(getDb(), actor, id));
  return (
    <>
      <p><Link href={`/giao-vien/lop/${data.assignment.classId}`}>← Về lớp</Link></p>
      <AssignmentReview data={data} />
    </>
  );
}
