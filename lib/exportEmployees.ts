// Solo funciones de escritura de xlsx (nunca XLSX.read/readFile), igual que lib/exportContracts.ts:
// la importación de empleados es por CSV justamente para no leer archivos con esa librería.

export type EmployeeExportRow = {
  legajo: string;
  apellido: string;
  nombre: string;
  dni: string;
  cuil: string;
  nacimiento: string;
  ingreso: string;
  baja: string;
  estado: string;
  puesto: string;
  categoria: string;
  area: string;
};

const COLUMN_WIDTHS = [10, 20, 20, 12, 15, 14, 14, 14, 12, 24, 18, 20];

export async function downloadEmployeesXlsx(rows: EmployeeExportRow[], filename: string) {
  const XLSX = await import("xlsx");
  const sheetRows = rows.map((r) => ({
    Legajo: r.legajo,
    Apellido: r.apellido,
    Nombre: r.nombre,
    DNI: r.dni,
    CUIL: r.cuil,
    "Fecha de nacimiento": r.nacimiento,
    "Fecha de ingreso": r.ingreso,
    "Fecha de baja": r.baja,
    Estado: r.estado,
    Puesto: r.puesto,
    Categoría: r.categoria,
    Área: r.area,
  }));
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Personal");
  XLSX.writeFile(workbook, filename);
}
