// Mismas funciones de solo-escritura de xlsx que lib/exportSics.ts (nunca
// XLSX.read/readFile), fuera del alcance de las vulnerabilidades conocidas
// de la librería.

export type ContractExportRow = {
  proveedor: string;
  equipos: string;
  plantaProyecto: string;
  tarifaMensualUsd: number;
  inicio: string;
  vencimiento: string;
  cuotasPagadas: number;
  cuotasRestantes: number;
  estado: string;
};

const COLUMN_WIDTHS = [22, 34, 20, 16, 14, 14, 14, 14, 16];

export async function downloadContractsXlsx(rows: ContractExportRow[], filename: string) {
  // Import dinámico: la librería (~90 kB) solo se baja al exportar, no al abrir la pantalla.
  const XLSX = await import("xlsx");
  const sheetRows = rows.map((r) => ({
    Proveedor: r.proveedor,
    Equipos: r.equipos,
    "Planta / Proyecto": r.plantaProyecto,
    "Tarifa mensual (USD)": r.tarifaMensualUsd,
    Inicio: r.inicio,
    Vencimiento: r.vencimiento,
    "Cuotas pagadas": r.cuotasPagadas,
    "Cuotas restantes": r.cuotasRestantes,
    Estado: r.estado,
  }));

  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Contratos");
  XLSX.writeFile(workbook, filename);
}
