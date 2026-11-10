import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { submissionStatusLabels, submissionTone } from "@/lib/labels";
import { requireStudent } from "@/lib/student";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Bài tập" };

export default async function StudentAssignmentsPage() {
  const { studentId } = await requireStudent();
  const db = getDb();
  const enrollments = await db.enrollment.findMany({ where: { studentId }, select: { classId: true } });
  const assignments = await db.assignment.findMany({
    where: { classId: { in: enrollments.map((item) => item.classId) } },
    include: {
      classGroup: { select: { name: true } },
      submissions: { where: { studentId }, orderBy: { attempt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const now = new Date();
  return (
    <>
      <div className="page-head"><h1>Bài tập</h1></div>
      {!assignments.length ? <Empty>Chưa có bài tập nào.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bài tập</th><th>Lớp</th><th>Hạn nộp</th><th>Tình trạng</th></tr></thead>
            <tbody>
              {assignments.map((item) => {
                const latest = item.submissions[0];
                return (
                  <tr key={item.id}>
                    <td><Link href={`/hoc-sinh/bai-tap/${item.id}`}>{item.title}</Link></td>
                    <td>{item.classGroup.name}</td>
                    <td>{item.dueAt ? formatDateTime(item.dueAt) : "—"}</td>
                    <td>{latest ? <><Badge tone={submissionTone[latest.status]}>{submissionStatusLabels[latest.status]}</Badge>{latest.score !== null && ` ${latest.score}/10`}</>
                      : <Badge tone={item.dueAt && item.dueAt < now ? "bad" : "warn"}>{item.dueAt && item.dueAt < now ? "Quá hạn" : "Chưa nộp"}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
