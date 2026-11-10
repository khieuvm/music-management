import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Không gian âm nhạc | Khóa học dành cho bạn",
    template: "%s | Không gian âm nhạc",
  },
  description: "Khám phá các khóa năng khiếu và kỹ năng: âm nhạc, cờ vua… offline hoặc online, học nhóm hoặc kèm 1–1.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
