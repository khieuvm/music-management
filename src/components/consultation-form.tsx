"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ConsultationFieldErrors, ConsultationResponse } from "@/lib/consultation-validation";

type CourseOption = { id: string; title: string };

export function ConsultationForm({ courses, selectedCourseId }: { courses: CourseOption[]; selectedCourseId: string }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<ConsultationFieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setStatus(null);
    setErrors({});
    try {
      const response = await fetch("/api/tu-van", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: data.get("contactName"),
          phone: data.get("phone"),
          courseId: data.get("courseId"),
          note: data.get("note"),
          consent: data.get("consent") === "on",
          website: data.get("website"),
        }),
      });
      const result: ConsultationResponse = await response.json();
      setStatus({ ok: response.ok && result.ok, message: result.message });
      setErrors(result.fieldErrors ?? {});
      if (response.ok && result.ok) form.reset();
    } catch (error) {
      console.error("Consultation request could not be completed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      setStatus({ ok: false, message: "Chưa xác nhận được việc gửi yêu cầu. Vui lòng kiểm tra kết nối và thử lại." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} aria-busy={pending}>
      <h2>Cùng tìm lớp phù hợp</h2>
      <p className="muted">Dấu * là thông tin bắt buộc. Không gửi thông tin nhạy cảm trong ghi chú.</p>
      {status && <div className={`status${status.ok ? "" : " error"}`} role={status.ok ? "status" : "alert"}>{status.message}</div>}
      <div className="form-field">
        <label htmlFor="contactName">Tên người liên hệ *</label>
        <input id="contactName" name="contactName" autoComplete="name" required minLength={2} maxLength={100} aria-invalid={Boolean(errors.contactName)} aria-describedby={errors.contactName ? "name-error" : undefined} />
        {errors.contactName && <p className="field-error" id="name-error">{errors.contactName[0]}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="phone">Số điện thoại *</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="Ví dụ: 0901234567" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-error" : undefined} />
        {errors.phone && <p className="field-error" id="phone-error">{errors.phone[0]}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="courseId">Khóa học quan tâm</label>
        <select id="courseId" name="courseId" defaultValue={selectedCourseId}>
          <option value="">Tôi cần tư vấn thêm</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="note">Bạn muốn chia sẻ thêm điều gì?</label>
        <textarea id="note" name="note" rows={4} maxLength={1000} placeholder="Mục tiêu học, hình thức hoặc lịch học mong muốn…" aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "note-error" : undefined} />
        {errors.note && <p className="field-error" id="note-error">{errors.note[0]}</p>}
      </div>
      <div className="honey-field" aria-hidden="true">
        <label htmlFor="website">Không điền ô này</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="consent">
        <input type="checkbox" name="consent" required aria-invalid={Boolean(errors.consent)} />
        <span>Tôi đồng ý để trung tâm sử dụng thông tin đã gửi nhằm liên hệ tư vấn theo <Link href="/quyen-rieng-tu">thông tin sử dụng dữ liệu</Link>. *</span>
      </label>
      {errors.consent && <p className="field-error">{errors.consent[0]}</p>}
      <button className="button full-width" type="submit" disabled={pending}>{pending ? "Đang gửi…" : "Gửi yêu cầu tư vấn ↗"}</button>
      <p className="muted">Bản local dùng dữ liệu giả. Chưa có email thông báo tự động hoặc nhân sự trực tiếp nhận.</p>
    </form>
  );
}
