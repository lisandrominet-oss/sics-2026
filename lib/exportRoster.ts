// Solo funciones de escritura de xlsx (nunca XLSX.read/readFile), igual que lib/exportEmployees.ts.

export type RosterHoursExportRow = {
  legajo: string;
  apellido: string;
  nombre: string;
  sitios: string;
  cuadrilla: string;
  diasTrabajados: number;
  diasViaje: number;
  diasFranco: number;
  diasVacaciones: number;
  diasLicencia: number;
  diasEnfermedad: number;
  diasAusencia: number;
  diasOtros: number;
  feriadosTrabajados: number;
  diasSinConfirmar: number;
  horasNormales: number;
  horasExtra50: number;
  horasExtra100: number;
  horasNocturnas: number;
  horasViaje: number;
  horasTotales: number;
  precioHora: number | null;
  moneda: string;
  costo: number | null;
  costoDetalle: string;
  diasSinTarifa: number;
};

const COLUMN_WIDTHS = [10, 20, 20, 22, 16, ...Array(10).fill(11), ...Array(6).fill(12), 12, 10, 14, 28, 12];

export async function downloadRosterHoursXlsx(rows: RosterHoursExportRow[], filename: string, withCost: boolean) {
  const XLSX = await import("xlsx");
  const sheetRows = rows.map((r) => ({
    Legajo: r.legajo,
    Apellido: r.apellido,
    Nombre: r.nombre,
    Sitios: r.sitios,
    Cuadrilla: r.cuadrilla,
    "Días trabajados": r.diasTrabajados,
    "Días de viaje": r.diasViaje,
    "Días de franco (confirmados)": r.diasFranco,
    "Días de vacaciones": r.diasVacaciones,
    "Días de licencia": r.diasLicencia,
    "Días de enfermedad / ART": r.diasEnfermedad,
    "Días de ausencia / suspensión": r.diasAusencia,
    "Bajadas / subidas demoradas": r.diasOtros,
    "Feriados trabajados": r.feriadosTrabajados,
    "Días sin confirmar": r.diasSinConfirmar,
    "Horas normales": r.horasNormales,
    "Horas extra 50%": r.horasExtra50,
    "Horas extra 100%": r.horasExtra100,
    "Horas nocturnas": r.horasNocturnas,
    "Horas de viaje": r.horasViaje,
    "Horas totales": r.horasTotales,
    ...(withCost
      ? { "Precio por hora": r.precioHora, Moneda: r.moneda, Costo: r.costo, "Detalle de costo (varias monedas)": r.costoDetalle, "Días sin tarifa": r.diasSinTarifa }
      : {}),
  }));
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Horas");
  XLSX.writeFile(workbook, filename);
}
