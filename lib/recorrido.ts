import type { SicStatus } from "@/lib/constants";

// Tramos del recorrido de una SIC (carriles del flujograma): Emisor, Jefe de área, Compras, Gerencia y Pañol.
export const TRAMOS = ["Emisor", "Jefe de área", "Compras", "Gerencia", "Pañol"] as const;

export type Recorrido = {
  /** Tramo donde está la SIC hoy (índice de TRAMOS). */
  tramo: number;
  /** Si la SIC ya no avanza: cerrada (todo hecho), rechazada (el tramo que la rechazó) o anulada. */
  fin?: "cerrada" | "rechazada" | "anulada";
};

// Solo presentación: dice en qué carril del flujograma espera cada estado (docs/flujograma-sic-src/make_html.py, ROWS).
// - en_observacion y pendiente_validacion_tecnica vuelven al Emisor (o a un jefe de su área, que es quien valida).
// - aprobada la emite Compras; orden_emitida y recibida se muestran en Pañol (recepción) aunque Compras cierre después.
// Si un estado cambia de carril en el circuito, se cambia acá y en el flujograma.
const MAPA: Record<SicStatus, Recorrido> = {
  enviada: { tramo: 2 },
  en_observacion: { tramo: 0 },
  pendiente_aprobacion_jefe: { tramo: 1 },
  rechazada_jefe: { tramo: 1, fin: "rechazada" },
  rechazada_compras: { tramo: 2, fin: "rechazada" },
  cotizando: { tramo: 2 },
  pendiente_validacion_tecnica: { tramo: 0 },
  pendiente_aprobacion_gerencia: { tramo: 3 },
  rechazada_gerencia: { tramo: 3, fin: "rechazada" },
  aprobada: { tramo: 2 },
  orden_emitida: { tramo: 4 },
  recibida: { tramo: 4 },
  cerrada: { tramo: 4, fin: "cerrada" },
  anulada: { tramo: 0, fin: "anulada" },
};

export function recorridoDe(status: SicStatus): Recorrido {
  return MAPA[status];
}

export type EstadoTramo = "hecho" | "ahora" | "falta" | "rechazado";

/** Estado visual de cada uno de los 5 tramos para una SIC. */
export function tramosDe(status: SicStatus): EstadoTramo[] {
  const { tramo, fin } = recorridoDe(status);
  return TRAMOS.map((_, i) => {
    if (fin === "cerrada") return "hecho";
    if (fin === "anulada") return "falta";
    if (fin === "rechazada") return i < tramo ? "hecho" : i === tramo ? "rechazado" : "falta";
    return i < tramo ? "hecho" : i === tramo ? "ahora" : "falta";
  });
}
