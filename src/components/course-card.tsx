import Link from "next/link";
import type { PublicCourse } from "@/lib/courses";
import { categoryLabels, classFormatLabels, deliveryLabels, formatVnd, subjectIcon } from "@/lib/format";

export function CourseCard({ course, index = 0 }: { course: PublicCourse; index?: number }) {
  const fees = course.offerings.flatMap((offering) =>
    offering.referenceFeeVnd === null ? [] : [offering.referenceFeeVnd],
  );
  return (
    <article className={`course-card tone-${index % 3}`}>
      <div className="course-art" aria-hidden="true">
        <span className="art-lines" /><span className="art-note">{subjectIcon(course.subject)}</span>
        <span className="instrument-label">{categoryLabels[course.category]} · {course.subject}</span>
      </div>
      <div className="course-body">
        <div className="tags">
          {[...new Set(course.offerings.map((o) => deliveryLabels[o.deliveryMode]))].map((label) =>
            <span key={label}>{label}</span>,
          )}
          {[...new Set(course.offerings.map((o) => classFormatLabels[o.format]))].map((label) =>
            <span key={label}>{label}</span>,
          )}
        </div>
        <h3><Link href={`/khoa-hoc/${course.slug}`}>{course.title}</Link></h3>
        <p>{course.summary}</p>
        <div className="course-bottom">
          <span>{fees.length ? `Tham khảo từ ${formatVnd(Math.min(...fees))}/khóa` : "Liên hệ học phí"}</span>
          <Link href={`/khoa-hoc/${course.slug}`} aria-label={`Khám phá ${course.title}`}>↗</Link>
        </div>
      </div>
    </article>
  );
}
