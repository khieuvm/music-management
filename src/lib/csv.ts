/** Excel-friendly CSV (BOM + CRLF) with formula-injection guard on every cell. */
export function toCsv(header: string[], rows: unknown[][]) {
  const escape = (value: unknown) => {
    let cell = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
