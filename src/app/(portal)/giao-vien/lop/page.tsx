import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { getDb } from "@/lib/db";
import { classStatusLabels } from "@/lib/labels";
import { requireTeacher } from "@/lib/teacher";

export const metadata = { title: "Lớp & bài tập" };

export default async function TeacherClassesPage() {
  const { teacherId } = await requireTeacher();
  const classes = await getDb().classGroup.findMany({
    where: { teacherId },
    include: {
      course: { select: { title: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      assignments: { select: { _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  return (
    <>
      <div className="page-head"><h1>Lớp phụ trách</h1></div>
      {!classes.length ? <Empty>Bạn chưa được phân công lớp chính nào.</Empty> : (
        <div className="card-list">
          {classes.map((item) => {
            const waiting = item.assignments.reduce((sum, assignment) => sum + assignment._count.submissions, 0);
            return (
              <Link className="panel link-card" key={item.id} href={`/giao-vien/lop/${item.id}`}>
                <div className="row-between">
                  <h2>{item.name} <span className="muted">{item.code}</span></h2>
                  <Badge>{classStatusLabels[item.status]}</Badge>
                </div>
                <p className="muted">{item.course.title} · {item._count.enrollments} học sinh{waiting ? ` · ${waiting} bài chờ chấm` : ""}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
