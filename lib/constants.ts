import type { Database } from "@/lib/database.types";

export type SicStatus = Database["public"]["Enums"]["sic_status"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type SicFileType = Database["public"]["Enums"]["sic_file_type"];
export type ComprasDecision = Database["public"]["Enums"]["compras_decision"];

export const STATUS_LABELS: Record<SicStatus, string> = {
  enviada: "Enviada",
  en_observacion: "En observación",
  pendiente_aprobacion_jefe: "Pendiente aprobación del jefe",
  rechazada_jefe: "Rechazada por el jefe",
  rechazada_compras: "Rechazada por Compras",
  cotizando: "En cotización",
  pendiente_validacion_tecnica: "Pendiente validación técnica",
  pendiente_aprobacion_gerencia: "Pendiente aprobación Gerencia",
  rechazada_gerencia: "Rechazada por Gerencia",
  aprobada: "Aprobada",
  orden_emitida: "Orden de compra emitida",
  recibida: "Recibida",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerencia: "Gerencia",
  compras: "Compras",
  panol: "Pañol",
  area: "Jefe de área",
  operativo: "Operativo",
};

export const SORT_OPTIONS = [
  { value: "updated_at", label: "Última actualización" },
  { value: "created_at", label: "Fecha de ingreso" },
  { value: "needed_by_date", label: "Fecha exigida" },
  { value: "final_amount", label: "Monto" },
  { value: "department", label: "Área" },
  { value: "status", label: "Estado" },
] as const;

export const FILE_TYPE_LABELS: Record<SicFileType, string> = {
  cotizacion: "Cotización",
  comparacion: "Comparación de precios",
  orden_compra: "Orden de compra",
  remito: "Remito",
  factura: "Factura",
  referencia: "Referencia",
  certificado_calidad: "Certificado de calidad",
  otro: "Otro",
};

export const MAX_SIC_ITEMS = 50;

// Estados en los que quien emitió la SIC todavía puede anularla (antes de que Compras la acepte).
export const REQUESTER_CANCELLABLE_STATUSES: SicStatus[] = ["pendiente_aprobacion_jefe", "en_observacion", "enviada"];

// Estados que ya no se pueden anular ni seguir (cerrados definitivamente).
export const TERMINAL_STATUSES: SicStatus[] = ["cerrada", "anulada"];

export const COMPRAS_EXPORTABLE_STATUSES: SicStatus[] = ["enviada", "en_observacion", "cotizando"];

export const CAN_CREATE_SIC: UserRole[] = ["operativo", "panol", "area", "gerencia", "compras", "admin"];

// Roles que Gerencia puede asignar al gestionar usuarios (todos menos administrador).
export const STAFF_ASSIGNABLE_ROLES: UserRole[] = ["operativo", "area", "compras", "gerencia", "panol"];

// Roles que exigen un área (planta) asignada.
export const ROLES_REQUIRING_PLANT: UserRole[] = ["area", "operativo", "panol"];

export const IMPERSONATABLE_ROLES: UserRole[] = ["gerencia", "compras", "panol", "area", "operativo"];

export function effectiveRole(profile: {
  role: UserRole | null;
  acting_as_role?: UserRole | null;
}): UserRole | null {
  if (!profile.role) return null;
  if (profile.role === "admin" && profile.acting_as_role) return profile.acting_as_role;
  return profile.role;
}

export function formatAmount(amount: number | null, currency: "ARS" | "USD") {
  if (amount === null) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Valor del selector de proyecto para "Taller": una SIC sin proyecto (project_id null). Distinto de "" para que
// "Seleccionar proyecto" (sin elegir todavía) siga bloqueando el envío con `required`.
export const PROJECT_TALLER = "__taller";

// Fecha sin hora (columnas `date`, ej. needed_by_date): "2026-10-07" no es un instante, así que no se pasa por la zona horaria.
export function formatSqlDate(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

// Días de hoy (en Buenos Aires) hasta una fecha sin hora; negativo si ya pasó.
export function daysUntilSqlDate(isoDate: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(isoDate) - toUtc(today)) / 86_400_000);
}

export function formatDate(iso: string) {
  // Zona fija: en el servidor (Vercel, UTC) y en el navegador la hora tiene que ser la misma.
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

// Supabase Storage (compatible con S3) rechaza ciertos caracteres en la key del
// archivo — típicamente símbolos como "°", tildes, espacios múltiples o paréntesis
// seguidos de ciertos signos. El nombre original se guarda aparte (en la columna
// file_name) para mostrarlo tal cual; esto solo sanea lo que se usa como path.
export function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";
  const safeBase = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return (safeBase || "archivo") + safeExt;
}
