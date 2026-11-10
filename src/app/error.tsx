"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page rendering failed", { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <main id="main" className="container section" role="alert">
      <h1 className="page-title">Chưa thể tải nội dung.</h1>
      <p className="intro">Hệ thống đang gặp lỗi. Vui lòng thử lại; nếu vẫn xảy ra, hãy báo người quản lý.</p>
      <button className="button" onClick={reset}>Thử lại</button>
    </main>
  );
}
