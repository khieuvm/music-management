import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { PortalNav } from "@/components/portal-nav";
import { homePathFor, roleLabels, type Actor } from "@/lib/access";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unreadCount } from "@/lib/services/notifications";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function linksFor(actor: Actor) {
  if (actor.role === "TEACHER") {
    return [
      { href: "/giao-vien", label: "Lịch dạy" },
      { href: "/giao-vien/lop", label: "Lớp & bài tập" },
      { href: "/giao-vien/gio-day", label: "Giờ dạy" },
    ];
  }
  if (actor.role === "STUDENT") {
    return [
      { href: "/hoc-sinh", label: "Tổng quan" },
      { href: "/hoc-sinh/lich", label: "Lịch & điểm danh" },
      { href: "/hoc-sinh/bai-tap", label: "Bài tập" },
      { href: "/hoc-sinh/hoc-phi", label: "Học phí" },
    ];
  }
  return [
    { href: "/quan-tri", label: "Tổng quan" },
    { href: "/quan-tri/tu-van", label: "Tư vấn" },
    { href: "/quan-tri/hoc-sinh", label: "Học sinh" },
    { href: "/quan-tri/giao-vien", label: "Giáo viên" },
    { href: "/quan-tri/khoa-hoc", label: "Khóa học" },
    { href: "/quan-tri/lop", label: "Lớp & lịch" },
    { href: "/quan-tri/hoc-phi", label: "Công nợ" },
    { href: "/quan-tri/gio-day", label: "Giờ dạy" },
    { href: "/quan-tri/luong", label: "Đơn giá lương" },
    ...(actor.role === "ADMIN"
      ? [{ href: "/quan-tri/tai-khoan", label: "Tài khoản" }, { href: "/quan-tri/nhat-ky", label: "Nhật ký" }]
      : []),
  ];
}

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const actor = await getActor();
  if (!actor) redirect("/dang-nhap");
  const unread = actor.mustChangePassword ? 0 : await unreadCount(getDb(), actor);
  return (
    <div className="portal">
      <a className="skip-link" href="#main">Đến nội dung chính</a>
      <header className="portal-header">
        <Link className="brand" href={homePathFor(actor.role)}>
          <span className="brand-icon" aria-hidden="true">♪</span>
          <span>Quản lý<br /><strong>lớp học</strong></span>
        </Link>
        <div className="portal-user">
          <span><strong>{actor.displayName}</strong> · {roleLabels[actor.role]}</span>
          {!actor.mustChangePassword && (
            <Link href="/thong-bao" className="notify-link" aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}>
              Thông báo{unread > 0 && <span className="count-badge">{unread > 99 ? "99+" : unread}</span>}
            </Link>
          )}
          <Link href="/doi-mat-khau">Đổi mật khẩu</Link>
          <form action={logoutAction}><button type="submit">Đăng xuất</button></form>
        </div>
      </header>
      {!actor.mustChangePassword && <PortalNav links={linksFor(actor)} />}
      <main id="main" className="portal-main">{children}</main>
    </div>
  );
}
