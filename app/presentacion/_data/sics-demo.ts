// Datos de las maquetas. Salen de SICS (lectura de la base, 23/10/2026) y quedan SIN personas, correos, montos ni proveedores:
// las personas se reemplazan por su rol. Si se vuelven a sacar de la base, mantener esa regla.
import type { SicStatus } from "@/lib/constants";

export type SicDemo = {
  code: string;
  prefix: string;
  asunto: string;
  estado: SicStatus;
  tipo: "normal" | "directa" | "cuenta_corriente";
  area: string;
  necesaria: string;
};

export const SICS_ACTIVAS: SicDemo[] = [
  {
    code: "SIC-GCIA-2026-0001",
    prefix: "GCIA",
    asunto: 'Chapa de 2 1/2"',
    estado: "orden_emitida",
    tipo: "normal",
    area: "Jefe de Compras",
    necesaria: "19/10/26",
  },
  {
    code: "SIC-COMP-2026-0005",
    prefix: "COMP",
    asunto: "Cascos para operarios",
    estado: "orden_emitida",
    tipo: "cuenta_corriente",
    area: "Jefe de Compras",
    necesaria: "19/10/26",
  },
];

// Cifras del Tablero (total, activas, cerradas) al 23/10/2026.
export const TABLERO = { totales: 8, pendientes: 2, cerradas: 4, activas: 2, historial: 6 };

// Recorrido real de la SIC-GCIA-2026-0001: la única que pasó por la aprobación de Gerencia.
export const RECORRIDO: { estado: SicStatus; rol: string; cuando: string }[] = [
  { estado: "enviada", rol: "Compras", cuando: "19/10 11:09" },
  { estado: "cotizando", rol: "Compras", cuando: "19/10 11:09" },
  { estado: "pendiente_validacion_tecnica", rol: "Compras", cuando: "19/10 11:10" },
  { estado: "pendiente_aprobacion_gerencia", rol: "Compras", cuando: "19/10 11:10" },
  { estado: "aprobada", rol: "Administrador", cuando: "19/10 11:11" },
  { estado: "orden_emitida", rol: "Compras", cuando: "19/10 11:11" },
];

export const ARTICULO_NUEVA_SIC = {
  asunto: "Cascos para operarios",
  fecha: "19/10/2026",
  articulo: "Casco Amarillo",
  cantidad: 10,
  area: "Jefe de Compras (COMP)",
};
