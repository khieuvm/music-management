import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { getPublishedCourses } from "@/lib/courses";
import { categorySlugs } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Khóa học" };

const filters = [
  { slug: "", label: "Tất cả" },
  { slug: "nang-khieu", label: "Năng khiếu" },
  { slug: "ky-nang", label: "Kỹ năng" },
] as const;

export default async function CoursesPage({ searchParams }: PageProps<"/khoa-hoc">) {
  const group = (await searchParams).nhom;
  const slug = typeof group === "string" && group in categorySlugs ? group as keyof typeof categorySlugs : "";
  const courses = await getPublishedCourses(slug ? categorySlugs[slug] : undefined);
  return (
    <main id="main" className="container section">
      <p className="eyebrow">MỖI HÀNH TRÌNH ĐỀU CÓ ĐIỂM BẮT ĐẦU</p>
      <h1 className="page-title">Tìm khóa học <em>của bạn.</em></h1>
      <p className="intro">Khám phá hình thức học phù hợp. Mức phí dưới đây là tham khảo toàn khóa; học phí và các đợt thanh toán sẽ được chốt khi ghi danh.</p>
      <nav className="filter-tabs" aria-label="Nhóm khóa học">
        {filters.map((filter) => (
          <Link key={filter.slug} href={filter.slug ? `/khoa-hoc?nhom=${filter.slug}` : "/khoa-hoc"} aria-current={slug === filter.slug ? "page" : undefined}>
            {filter.label}
          </Link>
        ))}
      </nav>
      {courses.length
        ? <div className="course-grid">{courses.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)}</div>
        : <p className="empty-state">Chưa có khóa học được công bố.</p>}
    </main>
  );
}
