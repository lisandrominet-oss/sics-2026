import type { Database } from "@/lib/database.types";

export type SicStatus = Database["public"]["Enums"]["sic_status"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type SicFileType = Database["public"]["Enums"]["sic_file_type"];
export type ComprasDecision = Database["public"]["Enums"]["compras_decision"];

export const STATUS_LABELS: Record<SicStatus, string> = {
  enviada: "Enviada",
  en_observacion: "En observación",
  rechazada_compras: "Rechazada por Compras",
  cotizando: "Aprobada por Compras",
  pendiente_validacion_tecnica: "Pendiente validación técnica",
  pendiente_aprobacion_gerencia: "Pendiente aprobación Gerencia",
  rechazada_gerencia: "Rechazada por Gerencia",
  aprobada: "Aprobada",
  orden_emitida: "Orden de compra emitida",
  recibida: "Recibida",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const STATUS_COLORS: Record<SicStatus, string> = {
  enviada: "bg-slate-100 text-slate-700",
  en_observacion: "bg-amber-100 text-amber-700",
  rechazada_compras: "bg-red-100 text-red-700",
  cotizando: "bg-amber-100 text-amber-700",
  pendiente_validacion_tecnica: "bg-amber-100 text-amber-700",
  pendiente_aprobacion_gerencia: "bg-amber-100 text-amber-700",
  rechazada_gerencia: "bg-red-100 text-red-700",
  aprobada: "bg-emerald-100 text-emerald-700",
  orden_emitida: "bg-blue-100 text-blue-700",
  recibida: "bg-blue-100 text-blue-700",
  cerrada: "bg-slate-200 text-slate-600",
  anulada: "bg-red-200 text-red-800",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerencia: "Gerencia",
  compras: "Compras",
  panol: "Pañol",
  area: "Área",
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

export const COMPRAS_EXPORTABLE_STATUSES: SicStatus[] = ["enviada", "en_observacion", "cotizando"];

export const CAN_CREATE_SIC: UserRole[] = ["area", "gerencia", "compras", "admin"];

export const IMPERSONATABLE_ROLES: UserRole[] = ["gerencia", "compras", "panol", "area"];

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

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
