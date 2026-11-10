import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentReview } from "@/components/portal/assignment-review";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isUuid, orNotFound } from "@/lib/page";
import { getAssignmentForTeacher } from "@/lib/services/assignments";

export default async function ManagerAssignmentPage({ params }: PageProps<"/quan-tri/bai-tap/[id]">) {
  const actor = await requireActor(["ADMIN", "STAFF"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await orNotFound(getAssignmentForTeacher(getDb(), actor, id));
  return (
    <>
      <p><Link href={`/quan-tri/lop/${data.assignment.classId}`}>← Về lớp</Link></p>
      <AssignmentReview data={data} />
    </>
  );
}
