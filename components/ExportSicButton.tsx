"use client";

import Button from "@/components/ui/Button";
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
    <Button variant="secondary" onClick={() => downloadSicsXlsx(rows, filename)}>
      {label ?? "Exportar a Excel"}
    </Button>
  );
}
