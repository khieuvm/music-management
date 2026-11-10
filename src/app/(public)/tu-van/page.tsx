import type { Metadata } from "next";
import { ConsultationForm } from "@/components/consultation-form";
import { getPublishedCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nhận tư vấn", robots: { index: false, follow: true } };

export default async function ConsultationPage({ searchParams }: PageProps<"/tu-van">) {
  const [courses, query] = await Promise.all([getPublishedCourses(), searchParams]);
  const selected = courses.find((course) => course.slug === query.khoa);
  return (
    <main id="main" className="container section form-layout">
      <div>
        <p className="eyebrow">MỘT CUỘC TRÒ CHUYỆN NHỎ, MỘT KHỞI ĐẦU MỚI</p>
        <h1 className="page-title">Tìm nhịp học<br /><em>phù hợp với bạn.</em></h1>
        <p className="intro">Chia sẻ mong muốn của bạn để lựa chọn khóa, hình thức học và lịch trình phù hợp. Bạn chưa cần có tài khoản để gửi yêu cầu.</p>
        <p>01 — Chọn khóa bạn quan tâm</p>
        <p>02 — Trao đổi nhu cầu và hình thức học</p>
        <p>03 — Quản lý xác nhận tuyển sinh và cấp tài khoản</p>
        <p className="muted">Tên thương hiệu và nội dung hiện tại chỉ là minh họa. Không gửi dữ liệu cá nhân thật khi thử nghiệm.</p>
      </div>
      <ConsultationForm courses={courses.map(({ id, title }) => ({ id, title }))} selectedCourseId={selected?.id ?? ""} />
    </main>
  );
}
