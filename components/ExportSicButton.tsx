"use client";

import { downloadSicsXlsx, type SicExportRow } from "@/lib/exportSics";

export default function ExportSicButton({
  rows,
  filename,
  label,
}: {
  rows: SicExportRow[];
  filename: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadSicsXlsx(rows, filename)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {label ?? "Exportar a Excel"}
    </button>
  );
}
