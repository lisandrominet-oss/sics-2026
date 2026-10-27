import type { SicStatus } from "@/lib/constants";

// Con la SIC ya resuelta (o rechazada) la fecha necesaria deja de correr: no se muestra la cuenta de días.
export const NO_DEADLINE_STATUSES: SicStatus[] = ["rechazada_jefe", "rechazada_compras", "rechazada_gerencia", "recibida", "cerrada", "anulada"];

export function deadlineText(days: number) {
  if (days === 0) return "Es hoy";
  if (days === 1) return "Falta 1 día";
  if (days > 1) return `Faltan ${days} días`;
  return days === -1 ? "Vencida hace 1 día" : `Vencida hace ${-days} días`;
}
