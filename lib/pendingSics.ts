import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SicStatus, UserRole } from "@/lib/constants";

// Estados que esperan una acción de cada rol. Para "area" (jefe) y "operativo" se complementa con
// lo que ya es suyo (ver applyPendingFilter): el jefe también ve lo que espera su aprobación.
export const PENDING_STATUSES_BY_ROLE: Partial<Record<UserRole, SicStatus[]>> = {
  compras: ["enviada", "cotizando", "aprobada", "recibida"],
  gerencia: ["pendiente_aprobacion_gerencia"],
  panol: ["orden_emitida"],
  area: ["pendiente_aprobacion_jefe", "pendiente_validacion_tecnica", "en_observacion"],
  operativo: ["pendiente_validacion_tecnica", "en_observacion"],
};

// Aplica el filtro de "pendientes de mi acción" según el rol. La lectura por área ya la limita la
// base (RLS): el jefe solo ve las SIC de su área, así que acá no hace falta filtrar por planta.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPendingFilter<Q extends { in: any; eq: any; or: any }>(query: Q, role: UserRole, profileId: string): Q {
  const statuses = PENDING_STATUSES_BY_ROLE[role] ?? [];
  if (role === "area") {
    // Jefe: lo que espera su aprobación (de toda el área) + lo suyo que está pendiente.
    return query.or(
      `status.eq.pendiente_aprobacion_jefe,and(requester_id.eq.${profileId},status.in.(pendiente_validacion_tecnica,en_observacion))`
    );
  }
  if (role === "operativo") {
    return query.eq("requester_id", profileId).in("status", statuses);
  }
  return query.in("status", statuses);
}

export async function getPendingSicsCount(
  supabase: SupabaseClient<Database>,
  role: UserRole,
  profileId: string
): Promise<number> {
  const statuses = PENDING_STATUSES_BY_ROLE[role];
  if (!statuses || statuses.length === 0) return 0;

  const { count } = await applyPendingFilter(
    supabase.from("sics").select("*", { count: "exact", head: true }),
    role,
    profileId
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
  limit = 8
): Promise<PendingSicSummary[]> {
  const statuses = PENDING_STATUSES_BY_ROLE[role];
  if (!statuses || statuses.length === 0) return [];

  const { data } = await applyPendingFilter(
    supabase.from("sics").select("id, code, subject, status, updated_at").order("updated_at", { ascending: false }).limit(limit),
    role,
    profileId
  );
  return data ?? [];
}
