import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SicStatus, UserRole } from "@/lib/constants";

// Estados que esperan una acción de cada rol. Para "area" (jefe) y "operativo" se complementa con
// lo que ya es suyo (ver applyPendingFilter): el jefe también ve lo que espera su aprobación.
export const PENDING_STATUSES_BY_ROLE: Partial<Record<UserRole, SicStatus[]>> = {
  // orden_emitida: Compras recibe los servicios y también los bienes si Pañol no los recibe.
  compras: ["enviada", "cotizando", "aprobada", "recibida", "orden_emitida"],
  gerencia: ["pendiente_aprobacion_gerencia"],
  panol: ["orden_emitida"],
  area: ["pendiente_aprobacion_jefe", "pendiente_validacion_tecnica", "en_observacion"],
  operativo: ["pendiente_validacion_tecnica", "en_observacion"],
};

// Aplica el filtro de "pendientes de mi acción" según el rol. Se filtra por área aunque la base (RLS)
// limite la lectura: con el permiso "Ver todas las SIC" el jefe lee las de todas las áreas, pero solo
// aprueba las de la suya (mismo criterio que get_pending_notifications en la base).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPendingFilter<Q extends { in: any; eq: any; or: any }>(
  query: Q,
  role: UserRole,
  profileId: string,
  plantId: string | null
): Q {
  const statuses = PENDING_STATUSES_BY_ROLE[role] ?? [];
  if (role === "area") {
    // Jefe: lo que espera su aprobación (de su área) + lo suyo que está pendiente.
    // Sin área solo queda el admin con "Ver como": ahí no hay área que filtrar.
    const bossClause = plantId ? `and(status.eq.pendiente_aprobacion_jefe,plant_id.eq.${plantId})` : "status.eq.pendiente_aprobacion_jefe";
    return query.or(
      `${bossClause},and(requester_id.eq.${profileId},status.in.(pendiente_validacion_tecnica,en_observacion))`
    );
  }
  if (role === "panol") {
    // Pañol: solo bienes con orden emitida que esperan recepción (no emite SIC).
    return query.eq("status", "orden_emitida").eq("is_service", false);
  }
  if (role === "compras") {
    // Compras: su circuito + toda orden emitida (recibe los servicios y puede recibir los bienes si Pañol no lo hace).
    return query.in("status", statuses);
  }
  if (role === "operativo") {
    return query.eq("requester_id", profileId).in("status", statuses);
  }
  return query.in("status", statuses);
}

export async function getPendingSicsCount(
  supabase: SupabaseClient<Database>,
  role: UserRole,
  profileId: string,
  plantId: string | null
): Promise<number> {
  const statuses = PENDING_STATUSES_BY_ROLE[role];
  if (!statuses || statuses.length === 0) return 0;

  const { count } = await applyPendingFilter(
    supabase.from("sics").select("*", { count: "exact", head: true }),
    role,
    profileId,
    plantId
  );
  return count ?? 0;
}

export type PendingSicSummary = {
  id: string;
  code: string;
  subject: string;
  status: SicStatus;
  updated_at: string;
};

export async function getPendingSicsList(
  supabase: SupabaseClient<Database>,
  role: UserRole,
  profileId: string,
  plantId: string | null,
  limit = 8
): Promise<PendingSicSummary[]> {
  const statuses = PENDING_STATUSES_BY_ROLE[role];
  if (!statuses || statuses.length === 0) return [];

  const { data } = await applyPendingFilter(
    supabase.from("sics").select("id, code, subject, status, updated_at").order("updated_at", { ascending: false }).limit(limit),
    role,
    profileId,
    plantId
  );
  return data ?? [];
}
