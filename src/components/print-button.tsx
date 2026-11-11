"use client";

export function PrintButton({ label = "In phiếu" }: { label?: string }) {
  return <button type="button" className="button small no-print" onClick={() => window.print()}>{label}</button>;
}
