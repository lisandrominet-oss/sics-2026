import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import DashboardControls from "@/components/DashboardControls";
import { IconArrowRight, IconPlusCircle } from "@/components/icons";
import {
  CAN_CREATE_SIC,
  SORT_OPTIONS,
  effectiveRole,
  formatAmount,
  formatDate,
  type SicStatus,
} from "@/lib/constants";

const PENDING_STATUSES_BY_ROLE: Record<string, SicStatus[]> = {
  compras: ["enviada", "cotizando", "aprobada", "recibida"],
  gerencia: ["pendiente_aprobacion_gerencia"],
  panol: ["orden_emitida"],
  area: ["pendiente_validacion_tecnica", "en_observacion"],
};

const SORT_COLUMNS = new Set(SORT_OPTIONS.map((o) => o.value));

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { filter?: string; q?: string; sort?: string; dir?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();
  const showPending = searchParams.filter === "mia";
  const pendingStatuses = PENDING_STATUSES_BY_ROLE[role] ?? [];

  const searchQuery = (searchParams.q ?? "").trim();
  const sortColumn = SORT_COLUMNS.has(searchParams.sort ?? "") ? searchParams.sort! : "updated_at";
  const sortDir: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";

  let query = supabase
    .from("sics")
    .select(
      "id, code, subject, status, currency, final_amount, estimated_amount, created_at, updated_at, needed_by_date, department, requester_id, plants(name, prefix)"
    )
    .order(sortColumn, { ascending: sortDir === "asc", nullsFirst: false });

  if (showPending && pendingStatuses.length > 0) {
    query = query.in("status", pendingStatuses);
  }
  if (showPending && role === "area") {
    query = query.eq("requester_id", profile.id);
  }
  if (searchQuery) {
    const safeQuery = searchQuery.replace(/[,()%_]/g, " ").trim();
    if (safeQuery) {
      query = query.or(`code.ilike.%${safeQuery}%,subject.ilike.%${safeQuery}%`);
    }
  }

  let pendingCountQuery = supabase.from("sics").select("*", { count: "exact", head: true });
  if (pendingStatuses.length > 0) {
    pendingCountQuery = pendingCountQuery.in("status", pendingStatuses);
  }
  if (role === "area") {
    pendingCountQuery = pendingCountQuery.eq("requester_id", profile.id);
  }

  const [{ data: sics, error }, { count: totalCount }, { count: pendingCount }, { count: closedCount }] =
    await Promise.all([
      query.limit(100),
      supabase.from("sics").select("*", { count: "exact", head: true }),
      pendingCountQuery,
      supabase.from("sics").select("*", { count: "exact", head: true }).eq("status", "cerrada"),
    ]);

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sistema de Compras
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Tablero</h1>
          </div>
          {CAN_CREATE_SIC.includes(role) && (
            <Link
              href="/sic/nueva"
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <IconPlusCircle className="h-4 w-4" />
              Nueva SIC
            </Link>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="SICs totales" value={totalCount ?? 0} caption="Vista general" />
          <StatCard label="Pendientes de mi acción" value={pendingCount ?? 0} caption="Requieren revisión" accent />
          <StatCard label="Cerradas" value={closedCount ?? 0} caption="Historial completo" />
        </div>

        <div className="mt-8 flex gap-2 text-sm">
          <FilterTab href="/dashboard" active={!showPending} label="Todas" />
          {role !== "admin" && (
            <FilterTab href="/dashboard?filter=mia" active={showPending} label="Pendientes de mi acción" />
          )}
        </div>

        <Suspense fallback={null}>
          <DashboardControls defaultQuery={searchQuery} sort={sortColumn} dir={sortDir} />
        </Suspense>

        {error && <p className="mt-4 text-sm text-red-600">{error.message}</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Actividad</p>
            <h2 className="text-base font-semibold text-slate-900">Solicitudes recientes</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {sics?.map((sic) => {
              const plant = sic.plants as { name: string; prefix: string } | null;
              return (
                <li key={sic.id}>
                  <Link
                    href={`/sic/${sic.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">
                        {plant?.prefix ?? "SIC"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{sic.code}</p>
                        <p className="truncate text-xs text-slate-500">{sic.subject}</p>
                        {sic.department && (
                          <p className="truncate text-xs text-slate-400">{sic.department}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden text-xs text-slate-400 lg:block">
                        {sic.needed_by_date ? `Necesaria: ${formatDate(sic.needed_by_date)}` : ""}
                      </span>
                      <span className="hidden text-sm text-slate-500 sm:block">
                        {formatAmount(sic.final_amount ?? sic.estimated_amount, sic.currency)}
                      </span>
                      <span className="hidden text-xs text-slate-400 md:block">{formatDate(sic.updated_at)}</span>
                      <StatusBadge status={sic.status} />
                      <span className="flex items-center gap-1 text-sm font-medium text-indigo-600">
                        Ver
                        <IconArrowRight />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {sics?.length === 0 && (
              <li className="px-6 py-10 text-center text-sm text-slate-400">
                No hay solicitudes para mostrar.
              </li>
            )}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ? "text-indigo-600" : "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{caption}</p>
    </div>
  );
}

function FilterTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}
