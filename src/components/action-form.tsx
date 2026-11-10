"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

export type FormActionResult = { ok: boolean; message: string } | null;

type Props = {
  action: (formData: FormData) => Promise<FormActionResult>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  /** Adds a fresh idempotency key so a double submit cannot create two records. */
  idempotent?: boolean;
  danger?: boolean;
  /** Keeps a one-time result (e.g. a temporary password) visible until the user confirms, then refreshes. */
  holdResult?: boolean;
};

/** redirect() inside a Server Action surfaces here after the router has already navigated. */
function isNavigation(error: unknown) {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}

function newKey() {
  return crypto.randomUUID();
}

export function ActionForm({ action, children, submitLabel, className, resetOnSuccess, confirmMessage, idempotent, danger, holdResult }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormActionResult>(null);
  const [key, setKey] = useState(newKey);
  const busy = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await action(formData);
        setResult(response);
        if (response?.ok) {
          if (resetOnSuccess) form.reset();
          if (idempotent) setKey(newKey());
          if (!holdResult) router.refresh();
        }
      } catch (error) {
        if (isNavigation(error)) return;
        console.error("Form action failed", { name: error instanceof Error ? error.name : "UnknownError" });
        setResult({ ok: false, message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; dữ liệu có thể chưa được lưu." });
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <form className={className ?? "stack"} onSubmit={submit} aria-busy={pending}>
      {idempotent && <input type="hidden" name="idempotencyKey" value={key} />}
      {children}
      {result && (
        <div className={`status${result.ok ? "" : " error"}`} role={result.ok ? "status" : "alert"}>{result.message}</div>
      )}
      {holdResult && result?.ok && (
        <div>
          <button className="button small secondary" type="button" onClick={() => { setResult(null); router.refresh(); }}>Đã ghi lại</button>
        </div>
      )}
      <div>
        <button className={`button small${danger ? " danger" : ""}`} type="submit" disabled={pending}>
          {pending ? "Đang xử lý…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
