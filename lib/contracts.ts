import type { Database } from "@/lib/database.types";
import type { BadgeTone } from "@/components/ui/Badge";

export type ContractItemType = Database["public"]["Enums"]["contract_item_type"];
export type ContractRenewalType = Database["public"]["Enums"]["contract_renewal_type"];
export type ContractInstallmentStatus = Database["public"]["Enums"]["contract_installment_status"];
export type ProviderInvoiceKind = Database["public"]["Enums"]["provider_invoice_kind"];
export type ProviderInvoiceStatus = Database["public"]["Enums"]["provider_invoice_status"];
export type ContractDocumentType = Database["public"]["Enums"]["contract_document_type"];

export const CONTRACT_ITEM_TYPE_LABELS: Record<ContractItemType, string> = {
  maquina: "Máquina",
  camioneta: "Camioneta",
  herramienta: "Herramienta",
};

export const CONTRACT_RENEWAL_TYPE_LABELS: Record<ContractRenewalType, string> = {
  automatica: "Automática",
  expresa: "Expresa",
  sin_renovacion: "Sin renovación",
};

export const CONTRACT_INSTALLMENT_STATUS_LABELS: Record<ContractInstallmentStatus, string> = {
  pendiente_de_factura: "Pendiente de factura",
  facturada: "Facturada",
  pagada: "Pagada",
  con_diferencia: "Con diferencia",
  diferencia_aceptada: "Diferencia aceptada",
};

export const CONTRACT_INSTALLMENT_STATUS_TONES: Record<ContractInstallmentStatus, BadgeTone> = {
  pendiente_de_factura: "neutral",
  facturada: "info",
  pagada: "success",
  con_diferencia: "danger",
  diferencia_aceptada: "warning",
};

export const PROVIDER_INVOICE_KIND_LABELS: Record<ProviderInvoiceKind, string> = {
  factura: "Factura",
  nota_credito: "Nota de crédito",
  pago: "Pago",
};

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<ContractDocumentType, string> = {
  contrato: "Contrato",
  adenda: "Adenda",
  condiciones: "Condiciones",
  seguro: "Seguro",
  acta_devolucion: "Acta de devolución",
  informe_horas: "Informe de horas",
  otro: "Otro",
};

export type ContractDisplayStatus = "vigente" | "por_vencer" | "vencido" | "devuelto";

const POR_VENCER_WINDOW_DAYS = 60;

// "vigente/por_vencer/vencido" no se guardan: se calculan acá por fecha,
// tal como pide la especificación (solo "devuelto" es un hecho real).
export function contractDisplayStatus(contract: { end_date: string; returned: boolean }): ContractDisplayStatus {
  if (contract.returned) return "devuelto";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(contract.end_date + "T00:00:00");
  const daysLeft = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "vencido";
  if (daysLeft <= POR_VENCER_WINDOW_DAYS) return "por_vencer";
  return "vigente";
}

export const CONTRACT_DISPLAY_STATUS_LABELS: Record<ContractDisplayStatus, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  devuelto: "Devuelto",
};

export const CONTRACT_DISPLAY_STATUS_TONES: Record<ContractDisplayStatus, BadgeTone> = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "danger",
  devuelto: "muted",
};

export function formatDateOnly(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00"));
}

export function formatUsd(amount: number | null) {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatArs(amount: number | null) {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

// Fecha límite = vencimiento − días de preaviso (regla 4.5).
export function noticeDeadline(contract: { end_date: string; notice_days: number }): Date {
  const end = new Date(contract.end_date + "T00:00:00");
  end.setDate(end.getDate() - contract.notice_days);
  return end;
}

export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Alertas de renovación: 60/30/15 días antes de la fecha límite (regla 4.5).
export function isRenewalAlertActive(contract: { end_date: string; notice_days: number; returned: boolean; renewal_type: ContractRenewalType }): boolean {
  if (contract.returned || contract.renewal_type === "sin_renovacion") return false;
  const days = daysUntil(noticeDeadline(contract));
  return days <= 60;
}
