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

// El cálculo de qué hace cada persona cada día vive en la base (roster_state): acá solo hay tipos, etiquetas,
// colores y helpers de fechas para dibujarlo.
export type DayState = "trabajo" | "franco" | "viaje_subida" | "viaje_bajada" | "vacaciones" | "licencia" | "enfermedad" | "ausencia";
export type ExceptionKind = "vacaciones" | "licencia" | "enfermedad" | "ausencia" | "extension" | "franco_extra";
export type Shift = "dia" | "noche";

export const DAY_STATE_LABELS: Record<DayState, string> = {
  trabajo: "Trabajo",
  franco: "Franco",
  viaje_subida: "Viaje de subida",
  viaje_bajada: "Viaje de bajada",
  vacaciones: "Vacaciones",
  licencia: "Licencia",
  enfermedad: "Enfermedad",
  ausencia: "Ausencia",
};

export const SHIFT_LABELS: Record<Shift, string> = { dia: "Día", noche: "Noche" };

export const EXCEPTION_KIND_LABELS: Record<ExceptionKind, string> = {
  vacaciones: "Vacaciones",
  licencia: "Licencia",
  enfermedad: "Enfermedad",
  ausencia: "Ausencia",
  extension: "Extensión de ciclo (trabaja)",
  franco_extra: "Franco extra (descansa)",
};

export const POSITION_SHIFT_LABELS: Record<string, string> = { dia: "Día", noche: "Noche", cualquiera: "Cualquiera" };

// Código corto de la celda y clases de color (las de color ya están cubiertas por el modo oscuro).
export function cellStyle(state: string, shift: string | null): { code: string; className: string } {
  switch (state) {
    case "trabajo":
      return shift === "noche"
        ? { code: "N", className: "bg-indigo-200 text-indigo-900" }
        : { code: "D", className: "bg-emerald-200 text-emerald-900" };
    case "franco":
      return { code: "F", className: "bg-slate-100 text-slate-400" };
    case "viaje_subida":
      return { code: "↑", className: "bg-amber-200 text-amber-900" };
    case "viaje_bajada":
      return { code: "↓", className: "bg-amber-100 text-amber-800" };
    case "vacaciones":
      return { code: "V", className: "bg-sky-200 text-sky-900" };
    case "licencia":
      return { code: "L", className: "bg-violet-200 text-violet-900" };
    case "enfermedad":
      return { code: "E", className: "bg-red-200 text-red-900" };
    case "ausencia":
      return { code: "A", className: "bg-red-100 text-red-800" };
    default:
      return { code: "?", className: "bg-slate-100 text-slate-500" };
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
