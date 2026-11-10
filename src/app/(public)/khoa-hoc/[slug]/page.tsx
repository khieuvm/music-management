import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCourse } from "@/lib/courses";
import { categoryLabels, classFormatLabels, deliveryLabels, formatVnd } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/khoa-hoc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  return course ? { title: course.title, description: course.summary } : { title: "Không tìm thấy khóa học" };
}

export default async function CoursePage({ params }: PageProps<"/khoa-hoc/[slug]">) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();

  return (
    <main id="main" className="container section">
      <Link className="text-link" href="/khoa-hoc">← Tất cả khóa học</Link>
      <div className="detail-layout">
        <article>
          <p className="eyebrow">{categoryLabels[course.category]} · {course.subject}</p>
          <h1 className="page-title">{course.title}</h1>
          <p className="intro">{course.summary}</p>
          <h2>Về khóa học</h2>
          <p className="prose">{course.description}</p>
          <h2>Khóa học dành cho ai?</h2>
          <p className="prose">{course.audience}</p>
        </article>
        <aside className="panel">
          <h2>Lựa chọn cách học</h2>
          {course.offerings.map((offering) => (
            <div className="offering" key={`${offering.deliveryMode}-${offering.format}`}>
              <strong>{deliveryLabels[offering.deliveryMode]} · {classFormatLabels[offering.format]}</strong>
              <p>{offering.referenceFeeVnd === null ? "Liên hệ học phí" : `${formatVnd(offering.referenceFeeVnd)}/khóa (tham khảo)`}</p>
            </div>
          ))}
          <p className="muted">Chốt tổng học phí và các đợt đóng khi ghi danh. Không thanh toán trực tuyến trên website.</p>
          <Link className="button full-width" href={`/tu-van?khoa=${encodeURIComponent(course.slug)}`}>Nhận tư vấn khóa này ↗</Link>
        </aside>
      </div>
    </main>
  );
}
