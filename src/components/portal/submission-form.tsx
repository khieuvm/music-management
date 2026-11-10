"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { FormActionResult } from "@/components/action-form";

type Props = {
  assignmentId: string;
  requireVideo: boolean;
  maxMb: number;
  action: (formData: FormData) => Promise<FormActionResult>;
};

function upload(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/tai-len");
    request.setRequestHeader("Content-Type", "application/octet-stream");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let body: { ok?: boolean; id?: string; message?: string } = {};
      try {
        body = JSON.parse(request.responseText);
      } catch {
        // handled below
      }
      if (request.status === 201 && body.id) resolve({ id: body.id });
      else reject(new Error(body.message ?? (request.status === 413 ? "Video quá lớn." : "Chưa tải được video lên. Vui lòng thử lại.")));
    };
    request.onerror = () => reject(new Error("Mất kết nối khi tải video. Vui lòng thử lại."));
    request.send(file);
  });
}

export function SubmissionForm({ assignmentId, requireVideo, maxMb, action }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<FormActionResult>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ name: string; size: number; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("video");
    formData.delete("video");
    setResult(null);
    if (file instanceof File && file.size > 0) {
      if (file.size > maxMb * 1024 * 1024) {
        setResult({ ok: false, message: `Video lớn hơn ${maxMb} MB. Hãy quay ngắn hơn hoặc chọn chất lượng thấp hơn.` });
        return;
      }
    } else if (requireVideo) {
      setResult({ ok: false, message: "Bài này cần nộp video." });
      return;
    }
    setBusy(true);
    try {
      if (file instanceof File && file.size > 0) {
        const previous = uploaded.current;
        let id = previous && previous.name === file.name && previous.size === file.size ? previous.id : "";
        if (!id) {
          setProgress(0);
          id = (await upload(file, setProgress)).id;
          uploaded.current = { name: file.name, size: file.size, id };
        }
        formData.set("videoFileId", id);
      }
      const response = await action(formData);
      setResult(response);
      if (response?.ok) {
        uploaded.current = null;
        form.reset();
        router.refresh();
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Chưa nộp được bài." });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form className="stack" onSubmit={submit} aria-busy={busy}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="form-field">
        <label htmlFor="video">Video bài làm{requireVideo ? " *" : ""}</label>
        <input id="video" name="video" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" capture="user" />
        <p className="muted">MP4, MOV (iPhone) hoặc WebM, tối đa {maxMb} MB. Có thể quay trực tiếp bằng điện thoại.</p>
      </div>
      <div className="form-field">
        <label htmlFor="textAnswer">Ghi chú gửi giáo viên</label>
        <textarea id="textAnswer" name="textAnswer" rows={3} maxLength={2000} />
      </div>
      {progress !== null && (
        <div className="upload-progress">
          <progress max={100} value={progress} aria-label="Tiến độ tải video" /> <span>{progress}%</span>
        </div>
      )}
      {result && <div className={`status${result.ok ? "" : " error"}`} role={result.ok ? "status" : "alert"}>{result.message}</div>}
      <div><button className="button small" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Nộp bài"}</button></div>
    </form>
  );
}
