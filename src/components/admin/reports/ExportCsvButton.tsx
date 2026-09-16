"use client";

import { Download } from "lucide-react";

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

export default function ExportCsvButton({ filename, rows }: { filename: string; rows: Record<string, string | number>[] }) {
  function download() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} disabled={rows.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg disabled:opacity-50">
      <Download className="size-3.5" aria-hidden /> Export CSV
    </button>
  );
}
