import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { SicStatus, UserRole } from "@/lib/constants";

export const PENDING_STATUSES_BY_ROLE: Partial<Record<UserRole, SicStatus[]>> = {
  compras: ["enviada", "cotizando", "aprobada", "recibida"],
  gerencia: ["pendiente_aprobacion_gerencia"],
  panol: ["orden_emitida"],
  area: ["pendiente_validacion_tecnica", "en_observacion"],
};

export async function getPendingSicsCount(
  supabase: SupabaseClient<Database>,
  role: UserRole,
  profileId: string
): Promise<number> {
  const statuses = PENDING_STATUSES_BY_ROLE[role];
  if (!statuses || statuses.length === 0) return 0;

  let query = supabase.from("sics").select("*", { count: "exact", head: true }).in("status", statuses);
  if (role === "area") {
    query = query.eq("requester_id", profileId);
  }
  const { count } = await query;
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

  let query = supabase
    .from("sics")
    .select("id, code, subject, status, updated_at")
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (role === "area") {
    query = query.eq("requester_id", profileId);
  }
  const { data } = await query;
  return data ?? [];
}
