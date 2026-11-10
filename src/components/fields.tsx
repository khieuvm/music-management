import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Base = { label: string; name: string; hint?: string };

export function Field({ label, name, hint, ...props }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="form-field">
      <label htmlFor={props.id ?? name}>{label}{props.required ? " *" : ""}</label>
      <input id={props.id ?? name} name={name} {...props} />
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, ...props }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="form-field">
      <label htmlFor={props.id ?? name}>{label}{props.required ? " *" : ""}</label>
      <textarea id={props.id ?? name} name={name} rows={3} {...props} />
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function Select({ label, name, hint, children, ...props }: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="form-field">
      <label htmlFor={props.id ?? name}>{label}{props.required ? " *" : ""}</label>
      <select id={props.id ?? name} name={name} {...props}>{children}</select>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
