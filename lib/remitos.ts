import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeTone } from "@/components/ui/Badge";

// Módulo "Remitos y Despachos". Los tipos de las tablas remito_* viven acá a mano hasta que se
// regenere lib/database.types.ts (al pasar el módulo a producción).

export type RemitoRole = "admin" | "administracion" | "logistica" | "calidad" | "obra_sitio" | "obra_calidad";
export type RemitoCategory = "permanente" | "retornable" | "consumible";
export type RemitoKind = "permanente" | "retornable" | "mixto";
export type RemitoStatus = "borrador" | "confirmado" | "anulado";
export type RemitoQuality = "pendiente" | "aprobado" | "rechazado";
export type RemitoFileKind = "carga" | "patentes" | "remito_oficial" | "otro";

export type RemitoProject = { id: string; code: string; name: string; active: boolean };

export type RemitoItem = {
  id: string;
  code: string;
  description: string;
  rubric: string | null;
  unit: string;
  category: RemitoCategory;
  stock: number;
  quality_status: RemitoQuality;
  quality_by_name: string | null;
  quality_at: string | null;
  active: boolean;
};

export type RemitoDispatch = {
  id: string;
  kind: RemitoKind;
  status: RemitoStatus;
  internal_no: string | null;
  official_no: string | null;
  project_id: string;
  dispatched_at: string;
  reason: string | null;
  carrier_company: string | null;
  driver_name: string | null;
  driver_dni: string | null;
  tractor_plate: string | null;
  trailer_plate: string | null;
  notes: string | null;
  driver_confirmed: boolean;
  signature_path: string | null;
  is_historical: boolean;
  created_by_name: string | null;
  created_at: string;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  cancelled_by_name: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type RemitoLine = {
  id: string;
  dispatch_id: string;
  line_no: number;
  item_id: string;
  qty: number;
  condition: RemitoCategory;
  est_return_date: string | null;
  official_no: string | null;
  notes: string | null;
  returned_qty: number;
};

export type RemitoFile = {
  id: string;
  dispatch_id: string;
  kind: RemitoFileKind;
  path: string;
  created_at: string;
};

export type RemitoEvent = {
  id: string;
  event_type: string;
  actor_name: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

export const REMITO_ROLE_LABELS: Record<RemitoRole, string> = {
  admin: "Administrador",
  administracion: "Administración",
  logistica: "Logística",
  calidad: "Calidad",
  obra_sitio: "Obra · Sitio",
  obra_calidad: "Obra · Calidad",
};

export const CATEGORY_LABELS: Record<RemitoCategory, string> = {
  permanente: "Permanente",
  retornable: "Retornable",
  consumible: "Consumible",
};

export const KIND_LABELS: Record<RemitoKind, string> = {
  permanente: "Permanente (galpón / estructura)",
  retornable: "Retornable / equipo / insumos",
  mixto: "Mixto",
};

export const KIND_SHORT: Record<RemitoKind, string> = {
  permanente: "Permanente",
  retornable: "Retornable",
  mixto: "Mixto",
};

export const STATUS_LABELS: Record<RemitoStatus, string> = {
  borrador: "Borrador",
  confirmado: "Confirmado",
  anulado: "Anulado",
};

export const STATUS_TONES: Record<RemitoStatus, BadgeTone> = {
  borrador: "warning",
  confirmado: "success",
  anulado: "critical",
};

export const QUALITY_LABELS: Record<RemitoQuality, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export const QUALITY_TONES: Record<RemitoQuality, BadgeTone> = {
  pendiente: "warning",
  aprobado: "success",
  rechazado: "danger",
};

export const FILE_KIND_LABELS: Record<RemitoFileKind, string> = {
  carga: "Foto de la carga",
  patentes: "Foto de patentes / seguridad",
  remito_oficial: "Remito oficial firmado",
  otro: "Otro archivo",
};

export const EVENT_LABELS: Record<string, string> = {
  alta: "Alta del ítem",
  calidad_aprobado: "Calidad aprobó",
  calidad_rechazado: "Calidad rechazó",
  calidad_pendiente: "Vuelto a pendiente de Calidad",
  stock: "Ajuste de stock",
  borrador_creado: "Borrador creado",
  borrador_editado: "Borrador editado",
  archivo_carga: "Foto de la carga agregada",
  archivo_patentes: "Foto de patentes agregada",
  archivo_remito_oficial: "Remito oficial adjuntado",
  archivo_otro: "Archivo agregado",
  archivo_quitado: "Archivo quitado",
  firma: "Firma del chofer cargada",
  firma_quitada: "Firma del chofer quitada",
  confirmado: "Salida confirmada",
  anulado: "Despacho anulado",
  remito_oficial: "N° de remito oficial",
  clasificacion: "Clasificación corregida",
};

// Qué puede hacer cada rol del módulo (la base lo vuelve a verificar en cada RPC).
export const CAN = {
  verAprobar: (r: RemitoRole | null) => r === "admin" || r === "calidad",
  gestionarItems: (r: RemitoRole | null) => r === "admin" || r === "logistica",
  armarDespachos: (r: RemitoRole | null) => r === "admin" || r === "logistica",
  aprobarCalidad: (r: RemitoRole | null) => r === "admin" || r === "calidad",
  corregirClasificacion: (r: RemitoRole | null) => r === "admin",
};

// Los tipos generados todavía no incluyen las tablas remito_*; se usa el cliente sin tipos de esquema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedClient = SupabaseClient<any, "public", any>;
export function untyped<T>(client: T): UntypedClient {
  return client as unknown as UntypedClient;
}

// Vercel corre en UTC: las horas se muestran siempre en la zona de Argentina (igual que formatDate en lib/constants.ts).
const TZ = "America/Argentina/Buenos_Aires";

const qtyFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
export function fmtQty(value: number | string | null | undefined): string {
  return qtyFmt.format(Number(value ?? 0));
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { timeZone: value.length === 10 ? undefined : TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

// Valor para <input type="datetime-local"> (hora local) a partir de un ISO, y de vuelta a ISO.
export function toLocalInput(iso: string | Date | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Ítems con la cantidad numérica (Supabase devuelve numeric como string o number según el cliente).
export function normItem(row: Record<string, unknown>): RemitoItem {
  return { ...(row as unknown as RemitoItem), stock: Number(row.stock ?? 0) };
}
export function normLine(row: Record<string, unknown>): RemitoLine {
  return { ...(row as unknown as RemitoLine), qty: Number(row.qty ?? 0), returned_qty: Number(row.returned_qty ?? 0) };
}

export const REMITO_BUCKET = "remito-files";

// Encabezado y pie del remito impreso. Pendiente de confirmar con Lisandro (el original imprime un texto de relleno).
export const REMITO_COMPANY_NAME = "Servicios Industriales";
