import Link from "next/link";
import { Badge, Empty } from "@/components/fields";
import { formatDateTime } from "@/lib/time";

type Item = {
  id: string;
  reason: string;
  status: "PENDING" | "ACKNOWLEDGED" | "CANCELLED";
  student: { fullName: string; code: string };
  lesson: { id: string; startsAt: Date; classGroup: { name: string } };
};

export function AbsenceList({ items, hrefFor }: { items: Item[]; hrefFor: (lessonId: string) => string }) {
  if (!items.length) return <Empty>Không có đơn xin nghỉ nào cho các buổi sắp tới.</Empty>;
  return (
    <ul className="plain-list">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.student.fullName}</strong> <span className="muted">{item.student.code}</span> ·{" "}
          <Link href={hrefFor(item.lesson.id)}>{item.lesson.classGroup.name}, {formatDateTime(item.lesson.startsAt)}</Link>{" "}
          {item.status === "PENDING" ? <Badge tone="warn">Mới</Badge> : <Badge>Đã xem</Badge>}
          <br /><span className="muted">{item.reason}</span>
        </li>
      ))}
    </ul>
  );
}

export const absenceListInclude = {
  student: { select: { fullName: true, code: true } },
  lesson: { select: { id: true, startsAt: true, classGroup: { select: { name: true } } } },
} as const;
