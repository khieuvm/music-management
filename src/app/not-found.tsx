import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container section">
      <p className="eyebrow">404</p>
      <h1 className="page-title">Chưa tìm thấy trang này.</h1>
      <p className="intro">Trang không tồn tại hoặc khóa học chưa được công bố.</p>
      <Link className="button" href="/khoa-hoc">Khám phá khóa học</Link>
    </main>
  );
}
