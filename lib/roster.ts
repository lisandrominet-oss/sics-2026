import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];

export type RosterSite = Tables["roster_sites"]["Row"];
export type RosterPattern = Tables["roster_patterns"]["Row"];
export type RosterPosition = Tables["roster_positions"]["Row"];
export type RosterCrew = Tables["roster_crews"]["Row"];
export type RosterException = Tables["roster_exceptions"]["Row"];
export type RosterAssignment = Functions["roster_assignments_list"]["Returns"][number];
export type RosterStateRow = Functions["roster_state"]["Returns"][number];
export type RosterEmployeeOption = Functions["roster_employee_options"]["Returns"][number];
export type RosterActualRow = Functions["roster_actual_state"]["Returns"][number];
export type RosterHoursRow = Functions["roster_hours_summary"]["Returns"][number];
export type RosterCostRow = Functions["roster_cost_summary"]["Returns"][number];
export type RosterRateRow = Functions["roster_rates_list"]["Returns"][number];
export type RosterHoliday = Tables["roster_holidays"]["Row"];
export type RosterPayRules = Tables["roster_pay_rules"]["Row"];
export type RosterClosure = Tables["roster_closures"]["Row"];
export type RosterEvent = Tables["roster_events"]["Row"];

// El cálculo de qué hace cada persona cada día vive en la base (roster_state): acá solo hay tipos, etiquetas,
// colores y helpers de fechas para dibujarlo.
export type DayState =
  | "trabajo"
  | "franco"
  | "viaje_subida"
  | "viaje_bajada"
  | "vacaciones"
  | "licencia"
  | "enfermedad"
  | "ausencia"
  | "bajada_anticipada"
  | "subida_demorada"
  | "capacitacion"
  | "suspension"
  | "accidente_art";
export type ExceptionKind =
  | "vacaciones"
  | "licencia"
  | "enfermedad"
  | "ausencia"
  | "extension"
  | "franco_extra"
  | "bajada_anticipada"
  | "subida_demorada"
  | "capacitacion"
  | "suspension"
  | "accidente_art";
export type Shift = "dia" | "noche";
export type ReasonKey = "salud" | "familiar" | "operativa" | "clima" | "disciplinaria" | "otro";

// Estados en los que la persona trabaja (llevan turno y horas de trabajo) y de viaje (llevan horas de viaje).
export const WORK_STATES: readonly string[] = ["trabajo", "capacitacion"];
export const TRAVEL_STATES: readonly string[] = ["viaje_subida", "viaje_bajada"];
export const HOURS_STATES: readonly string[] = [...WORK_STATES, ...TRAVEL_STATES];

export const DAY_STATE_LABELS: Record<DayState, string> = {
  trabajo: "Trabajo",
  franco: "Franco",
  viaje_subida: "Viaje de subida",
  viaje_bajada: "Viaje de bajada",
  vacaciones: "Vacaciones",
  licencia: "Licencia",
  enfermedad: "Enfermedad",
  ausencia: "Ausencia",
  bajada_anticipada: "Bajada anticipada",
  subida_demorada: "Subida demorada",
  capacitacion: "Capacitación",
  suspension: "Suspensión",
  accidente_art: "Accidente / ART",
};

export const REASON_LABELS: Record<ReasonKey, string> = {
  salud: "Salud",
  familiar: "Familiar",
  operativa: "Operativa",
  clima: "Clima",
  disciplinaria: "Disciplinaria",
  otro: "Otro",
};

export const SHIFT_LABELS: Record<Shift, string> = { dia: "Día", noche: "Noche" };

export const EXCEPTION_KIND_LABELS: Record<ExceptionKind, string> = {
  vacaciones: "Vacaciones",
  licencia: "Licencia",
  enfermedad: "Enfermedad",
  ausencia: "Ausencia",
  extension: "Extensión de ciclo (se queda trabajando)",
  franco_extra: "Franco extra (descansa)",
  bajada_anticipada: "Bajada anticipada",
  subida_demorada: "Subida demorada",
  capacitacion: "Capacitación",
  suspension: "Suspensión",
  accidente_art: "Accidente / ART",
};

export const POSITION_SHIFT_LABELS: Record<string, string> = { dia: "Día", noche: "Noche", cualquiera: "Cualquiera" };

// Código corto de la celda y clases de color (todo por tokens: el modo oscuro sale solo).
// Sistema de B: la tinta marca el trabajo (día en tono suave, noche en tinta), el amarillo de la marca marca el viaje y las
// demoras, el rojo solo lo que falta o falla. Las ausencias se distinguen por la forma (borde, trazo punteado), no por un color nuevo.
export function cellStyle(state: string, shift: string | null): { code: string; className: string } {
  switch (state) {
    case "trabajo":
      return shift === "noche"
        ? { code: "N", className: "border border-transparent bg-slate-800 text-white dark:bg-slate-300 dark:text-slate-900" }
        : { code: "D", className: "border border-transparent bg-slate-200 text-slate-900" };
    case "franco":
      return { code: "F", className: "border border-transparent font-normal text-slate-400" };
    case "viaje_subida":
    case "viaje_bajada":
      return { code: state === "viaje_subida" ? "↑" : "↓", className: "border border-transparent bg-brand/40 text-slate-900" };
    case "vacaciones":
      return { code: "V", className: "border border-slate-400 bg-sheet text-slate-900" };
    case "licencia":
      return { code: "L", className: "border border-slate-300 bg-slate-100 text-slate-900" };
    case "enfermedad":
      return { code: "E", className: "border border-red-300 bg-red-100 text-red-800" };
    case "ausencia":
      return { code: "A", className: "border border-transparent bg-red-50 text-red-700" };
    case "bajada_anticipada":
      return { code: "B!", className: "border border-ink bg-brand text-on-brand" };
    case "subida_demorada":
      return { code: "S!", className: "border border-ink bg-brand text-on-brand" };
    case "capacitacion":
      return { code: "C", className: "border border-dashed border-slate-400 text-slate-900" };
    case "suspension":
      return { code: "Su", className: "border border-red-500 bg-red-50 text-red-800" };
    case "accidente_art":
      return { code: "AR", className: "border border-transparent bg-red-600 text-white" };
    default:
      return { code: "?", className: "border border-transparent bg-slate-100 text-slate-500" };
  }
}

// ---------------------------------------------------------------- fechas (texto AAAA-MM-DD, sin horas)
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | undefined | null): value is string {
  if (!value || !ISO.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  // Mismo rango que acepta la base (2000-2100): una URL con otra fecha no tiene que romper la página.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-01-01";
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000);
}

// Hoy en Buenos Aires (el mismo resultado en el servidor y en el navegador).
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function dayRange(fromIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(fromIso, i));
}

const WEEKDAY = new Intl.DateTimeFormat("es-AR", { weekday: "narrow", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

export const weekdayLetter = (iso: string) => WEEKDAY.format(new Date(iso + "T00:00:00Z")).toUpperCase();
export const longDate = (iso: string) => LONG.format(new Date(iso + "T00:00:00Z"));
export const monthLabel = (iso: string) => {
  const s = MONTH.format(new Date(iso + "T00:00:00Z"));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
export const isWeekend = (iso: string) => [0, 6].includes(new Date(iso + "T00:00:00Z").getUTCDay());

// ---------------------------------------------------------------- regímenes
export function cycleLength(p: Pick<RosterPattern, "work_days" | "rest_days" | "travel_in_days" | "travel_out_days" | "travel_inside_cycle">) {
  return p.work_days + p.rest_days + (p.travel_inside_cycle ? 0 : p.travel_in_days + p.travel_out_days);
}

// Largo del bloque en sitio, con los días de viaje.
export function workBlockLength(p: Pick<RosterPattern, "work_days" | "travel_in_days" | "travel_out_days" | "travel_inside_cycle">) {
  return p.travel_inside_cycle ? p.work_days : p.travel_in_days + p.work_days + p.travel_out_days;
}

export function describePattern(p: RosterPattern): string {
  const travel =
    p.travel_in_days + p.travel_out_days === 0
      ? "sin días de viaje"
      : `viaje ${p.travel_inside_cycle ? "dentro del bloque" : "aparte"} (${p.travel_in_days} de subida, ${p.travel_out_days} de bajada)`;
  return `${p.work_days} de trabajo, ${p.rest_days} de franco · ciclo de ${cycleLength(p)} días · ${travel}`;
}

// Cuadrilla espejo: su bloque en sitio empieza cuando termina el de la cuadrilla de referencia, así siempre
// hay una cuadrilla en sitio (es una sugerencia: se puede ajustar).
export function suggestMirrorAnchor(refAnchorIso: string, pattern: RosterPattern): string {
  return addDays(refAnchorIso, workBlockLength(pattern));
}

export function employeeLabel(e: { last_name: string; first_name: string }) {
  return `${e.last_name}, ${e.first_name}`;
}

// ---------------------------------------------------------------- horas y plata
// Horas con coma y hasta 2 decimales ("12", "7,5").
export function formatHours(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}

// Importe con centavos (los precios por hora no son enteros).
export function formatMoney(n: number | null | undefined, currency: string | null | undefined): string {
  if (n === null || n === undefined) return "-";
  const cur = currency === "USD" ? "USD" : "ARS";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Primer día y último día del mes de una fecha (texto AAAA-MM-DD).
export function monthBounds(iso: string): { from: string; to: string } {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
