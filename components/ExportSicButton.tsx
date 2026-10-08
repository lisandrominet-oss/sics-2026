"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { notify } from "@/lib/notify";
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
  const [exporting, setExporting] = useState(false);

  async function handleClick() {
    setExporting(true);
    try {
      await downloadSicsXlsx(rows, filename);
    } catch {
      notify.error("No se pudo exportar", "No se pudo generar el Excel. Revisá la conexión y probá de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} loading={exporting}>
      {label ?? "Exportar a Excel"}
    </Button>
  );
}
