"use client";

import { Download } from "lucide-react";

export type ExcelRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: ExcelRow[string]) {
  const text = value == null ? "" : String(value);
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function ExcelExportButton({ rows, filename, label = "Скачать Excel" }: { rows: ExcelRow[]; filename: string; label?: string }) {
  function download() {
    if (!rows.length) return;
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const html = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}th{font-weight:700;background:#f3f4f6}</style></head><body>${table}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return <button type="button" className="btn secondary" onClick={download} disabled={!rows.length}><Download size={17}/>{label}</button>;
}
