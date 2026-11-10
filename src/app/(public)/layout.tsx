import Link from "next/link";
import { isDemoMode } from "@/lib/demo";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a className="skip-link" href="#main">Đến nội dung chính</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Không gian âm nhạc — Trang chủ">
          <span className="brand-icon" aria-hidden="true">♪</span>
          <span>Không gian<br /><strong>âm nhạc</strong></span>
        </Link>
        <nav aria-label="Điều hướng chính">
          <Link href="/khoa-hoc">Khóa học</Link>
          <Link href="/#ve-chung-toi">Về chúng tôi</Link>
          <Link href="/dang-nhap">Đăng nhập</Link>
          <Link className="button small" href="/tu-van">Nhận tư vấn <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        <p>Không gian âm nhạc — Học theo nhịp riêng của bạn.</p>
        <p className="muted">{isDemoMode() ? "Bản demo" : "Bản phát triển local"} · Nội dung và khóa học minh họa, không phải thông tin tuyển sinh thật.</p>
        <Link href="/quyen-rieng-tu">Thông tin sử dụng dữ liệu</Link>
      </footer>
    </>
  );
}
