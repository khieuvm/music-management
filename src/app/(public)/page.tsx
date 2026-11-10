import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { getPublishedCourses } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function Home() {
  const courses = await getPublishedCourses();
  return (
    <main id="main">
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow"><span className="dot" /> MỘT HÀNH TRÌNH, NHIỀU GIAI ĐIỆU</p>
          <h1>Âm nhạc bắt đầu<br />từ <em>chính bạn.</em></h1>
          <p className="hero-description">Không cần phải có năng khiếu để bắt đầu. Tìm lớp học phù hợp, khám phá điều mình yêu thích và tiến bộ theo nhịp riêng.</p>
          <div className="hero-actions">
            <Link className="button" href="/khoa-hoc">Khám phá khóa học <span aria-hidden="true">↗</span></Link>
            <Link className="text-link" href="/tu-van">Tôi cần tư vấn <span aria-hidden="true">→</span></Link>
          </div>
          <p className="hero-footnote">Offline & online <span>·</span> Học nhóm & kèm 1–1</p>
        </div>
        <div className="hero-art" role="img" aria-label="Minh họa phím đàn và những giai điệu">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" />
          <span className="floating-note note-one">♫</span>
          <span className="floating-note note-two">♪</span>
          <div className="piano"><span /><span /><span /><span /><span /><span /><span /></div>
          <div className="art-caption"><span className="dot" /> MỖI NGÀY, MỘT CHÚT TIẾN BỘ</div>
        </div>
      </section>
      <div className="value-strip">
        <span>Bắt đầu từ cơ bản</span><span>Lựa chọn hình thức phù hợp</span><span>Theo dõi hành trình học</span>
      </div>
      <section className="container section" aria-labelledby="courses-heading">
        <div className="section-heading">
          <div><p className="eyebrow">TÌM GIAI ĐIỆU CỦA BẠN</p><h2 id="courses-heading">Bạn muốn bắt đầu từ đâu?</h2></div>
          <Link className="text-link" href="/khoa-hoc">Tất cả khóa học →</Link>
        </div>
        {courses.length
          ? <div className="course-grid">{courses.slice(0, 3).map((course, index) => <CourseCard key={course.id} course={course} index={index} />)}</div>
          : <p className="empty-state">Chưa có khóa học được công bố. Bạn có thể gửi yêu cầu tư vấn để được hỗ trợ.</p>}
      </section>
      <section id="ve-chung-toi" className="about-section container">
        <p className="eyebrow">KHÔNG CHỈ LÀ NHỮNG NỐT NHẠC</p>
        <h2>Một không gian để học,<br />thử và <em>tự tin hơn.</em></h2>
        <p>Chọn cách học phù hợp với lịch trình và mục tiêu của bạn. Tài khoản học sinh giúp bạn và gia đình cùng theo dõi lịch học, nhận xét và quá trình học tập.</p>
        <Link className="button" href="/tu-van">Cùng tìm lớp phù hợp ↗</Link>
      </section>
    </main>
  );
}
