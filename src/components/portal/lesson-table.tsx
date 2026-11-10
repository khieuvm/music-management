import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { lessonStatusLabels, lessonTone } from "@/lib/labels";
import { formatDateTime, formatTime } from "@/lib/time";

type LessonRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: keyof typeof lessonStatusLabels;
  topic: string;
  classGroup: { code: string; name: string; location?: string; meetingUrl?: string };
  teacher?: { fullName: string };
};

export function LessonTable({ lessons, hrefFor, empty = "Chưa có buổi học." }: { lessons: LessonRow[]; hrefFor?: (id: string) => string; empty?: string }) {
  if (!lessons.length) return <Empty>{empty}</Empty>;
  const showTeacher = lessons.some((lesson) => lesson.teacher);
  return (
    <div className="table-wrap">
      <table className="stack-table">
        <thead><tr><th>Thời gian</th><th>Lớp</th>{showTeacher && <th>Giáo viên</th>}<th>Nơi học</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {lessons.map((lesson) => (
            <tr key={lesson.id}>
              <td data-label="Thời gian">{hrefFor ? <Link href={hrefFor(lesson.id)}>{formatDateTime(lesson.startsAt)}</Link> : formatDateTime(lesson.startsAt)}–{formatTime(lesson.endsAt)}</td>
              <td data-label="Lớp">{lesson.classGroup.name}<br /><span className="muted">{lesson.classGroup.code}{lesson.topic ? ` · ${lesson.topic}` : ""}</span></td>
              {showTeacher && <td data-label="Giáo viên">{lesson.teacher?.fullName ?? ""}</td>}
              <td data-label="Nơi học">{lesson.classGroup.meetingUrl ? <a href={lesson.classGroup.meetingUrl} target="_blank" rel="noreferrer">Vào lớp online</a> : lesson.classGroup.location || "—"}</td>
              <td data-label="Trạng thái"><Badge tone={lessonTone[lesson.status]}>{lessonStatusLabels[lesson.status]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
