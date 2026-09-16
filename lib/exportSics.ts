// Solo usamos las funciones de escritura de xlsx (nunca XLSX.read/readFile),
// que no están afectadas por las vulnerabilidades conocidas de la librería
// (todas relacionadas con el parseo de archivos xlsx no confiables).
import * as XLSX from "xlsx";

export type SicExportRow = {
  codigo: string;
  asunto: string;
  planta: string;
  proyecto: string;
  solicitante: string;
  area: string;
  fechaNecesaria: string;
  articulo: string;
  cantidad: number;
  especificaciones: string;
};

const COLUMN_WIDTHS = [16, 30, 14, 18, 22, 18, 14, 34, 10, 32];

export function downloadSicsXlsx(rows: SicExportRow[], filename: string) {
  const sheetRows = rows.map((r) => ({
    SIC: r.codigo,
    Asunto: r.asunto,
    Planta: r.planta,
    Proyecto: r.proyecto,
    Solicitante: r.solicitante,
    "Área / Departamento": r.area,
    "Fecha necesaria": r.fechaNecesaria,
    Artículo: r.articulo,
    Cantidad: r.cantidad,
    Especificaciones: r.especificaciones,
  }));

  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "SICs");
  XLSX.writeFile(workbook, filename);
}
