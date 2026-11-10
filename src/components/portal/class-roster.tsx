import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import type { classProgress } from "@/lib/services/student-notes";
import { formatDate } from "@/lib/time";

type Progress = Awaited<ReturnType<typeof classProgress>>;
type Row = { id: string; code: string; fullName: string };

/** Roster with attendance and homework progress; each row links to the per-student page. */
export function ClassRoster({ students, progress, hrefFor }: { students: Row[]; progress: Progress; hrefFor: (studentId: string) => string }) {
  if (!students.length) return <Empty>Chưa có học sinh.</Empty>;
  return (
    <div className="table-wrap">
      <table className="stack-table">
        <thead><tr><th>Học sinh</th><th>Chuyên cần</th><th>Bài tập</th><th>Nhận xét gần nhất</th><th /></tr></thead>
        <tbody>
          {students.map((student) => {
            const item = progress.get(student.id);
            const { recorded, attended, excused, absent } = item.attendance;
            return (
              <tr key={student.id}>
                <td data-label="Học sinh"><strong>{student.fullName}</strong> <span className="muted">{student.code}</span></td>
                <td data-label="Chuyên cần">
                  {recorded ? <>{attended}/{recorded} buổi</> : <span className="muted">Chưa điểm danh</span>}
                  {excused > 0 && <> · <Badge>{excused} có phép</Badge></>}
                  {absent > 0 && <> · <Badge tone="bad">{absent} vắng</Badge></>}
                </td>
                <td data-label="Bài tập">
                  {item.submitted}/{progress.assignmentCount} đã nộp
                  {item.waiting > 0 && <> · <Badge tone="warn">{item.waiting} chờ chấm</Badge></>}
                </td>
                <td data-label="Nhận xét gần nhất">{item.lastNoteAt ? formatDate(item.lastNoteAt) : <span className="muted">Chưa có</span>}</td>
                <td><Link className="button small secondary" href={hrefFor(student.id)}>Xem & nhận xét</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
