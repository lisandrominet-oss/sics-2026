import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import DashboardControls from "@/components/DashboardControls";
import SicsList, { type SicRow } from "@/components/SicsList";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { IconPlusCircle } from "@/components/icons";
import { eyebrowClass, numClass } from "@/lib/ui";
import { CAN_CREATE_SIC, SORT_OPTIONS, effectiveRole } from "@/lib/constants";
import { PENDING_STATUSES_BY_ROLE, applyPendingFilter, getPendingSicsCount } from "@/lib/pendingSics";

// Tope de filas del Tablero; si se alcanza, se avisa debajo de la lista.
const LIST_LIMIT = 100;
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
  const canSeeCerts = role === "compras" || role === "admin";
  const showPending = searchParams.filter === "mia";
  const isAreaRole = role === "area" || role === "operativo";
  const canHaveOwn = isAreaRole || role === "panol";
  const showMine = searchParams.filter === "mias" && canHaveOwn;
  const showPendingCerts = searchParams.filter === "certificados" && canSeeCerts;
  const pendingStatuses = PENDING_STATUSES_BY_ROLE[role] ?? [];

  const searchQuery = (searchParams.q ?? "").trim();
  const sortColumn = SORT_COLUMNS.has(searchParams.sort ?? "") ? searchParams.sort! : "updated_at";
  const sortDir: "asc" | "desc" = searchParams.dir === "asc" ? "asc" : "desc";

  const { data: certRows } = canSeeCerts
    ? await supabase.rpc("get_pending_quality_certificates")
    : { data: [] as { sic_id: string }[] | null };
  const certSicIds = Array.from(new Set((certRows ?? []).map((r) => r.sic_id)));

  let query = supabase
    .from("sics")
    .select(
      "id, code, subject, status, currency, final_amount, estimated_amount, created_at, updated_at, needed_by_date, department, requester_id, on_behalf_of, purchase_type, plants(name, prefix), project:projects(name), requester:profiles!sics_requester_id_fkey(full_name, email)"
    )
    .order(sortColumn, { ascending: sortDir === "asc", nullsFirst: false });

  if (showPending && pendingStatuses.length > 0) {
    query = applyPendingFilter(query, role, profile.id);
  }
  if (showMine) {
    query = query.eq("requester_id", profile.id);
  }
  if (showPendingCerts) {
    query = query.in("id", certSicIds.length > 0 ? certSicIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (searchQuery) {
    const safeQuery = searchQuery.replace(/[,()%_]/g, " ").trim();
    if (safeQuery) {
      // También busca dentro de los artículos, para detectar pedidos repetidos (ej. "rodamiento 6205").
      const { data: itemHits } = await supabase
        .from("sic_items")
        .select("sic_id")
        .ilike("description", `%${safeQuery}%`)
        .limit(200);
      const itemSicIds = Array.from(new Set((itemHits ?? []).map((r) => r.sic_id)));
      const itemClause = itemSicIds.length > 0 ? `,id.in.(${itemSicIds.join(",")})` : "";
      query = query.or(`code.ilike.%${safeQuery}%,subject.ilike.%${safeQuery}%${itemClause}`);
    }
  }

  const [{ data: sics, error }, { count: totalCount }, pendingCount, { count: closedCount }] =
    await Promise.all([
      query.limit(LIST_LIMIT),
      supabase.from("sics").select("*", { count: "exact", head: true }),
      getPendingSicsCount(supabase, role, profile.id),
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
        <PageHeader
          title="Tablero"
          actions={
            CAN_CREATE_SIC.includes(role) && (
              <Link href="/sic/nueva" className={buttonClass()}>
                <IconPlusCircle className="h-4 w-4" />
                Nueva SIC
              </Link>
            )
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="SICs totales" value={totalCount ?? 0} caption="Vista general" />
          <StatCard label="Pendientes de mi acción" value={pendingCount} caption="Requieren revisión" accent />
          <StatCard label="Cerradas" value={closedCount ?? 0} caption="Historial completo" />
        </div>

        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          <FilterTab
            href="/dashboard"
            active={!showPending && !showPendingCerts && !showMine}
            label={isAreaRole ? "Mi área" : "Todas"}
          />
          {canHaveOwn && <FilterTab href="/dashboard?filter=mias" active={showMine} label="Mis solicitudes" />}
          {role !== "admin" && (
            <FilterTab
              href="/dashboard?filter=mia"
              active={showPending}
              label="Pendientes de mi acción"
              dot={pendingCount > 0}
            />
          )}
          {canSeeCerts && (
            <FilterTab
              href="/dashboard?filter=certificados"
              active={showPendingCerts}
              label="Certificados pendientes"
              dot={certSicIds.length > 0}
            />
          )}
        </div>

        <Suspense
          fallback={
            <div className="mt-4 flex flex-wrap items-center gap-3" aria-hidden="true">
              <Skeleton className="h-10 min-w-[16rem] flex-1 rounded-lg" />
              <Skeleton className="h-10 w-52 rounded-lg" />
              <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
          }
        >
          <DashboardControls defaultQuery={searchQuery} sort={sortColumn} dir={sortDir} />
        </Suspense>

        {error && <p role="alert" className="animate-shake mt-4 text-sm text-red-600">{error.message}</p>}

        <Card padding="none" className="mt-4 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className={eyebrowClass}>Actividad</p>
            <h2 className="text-base font-semibold text-slate-900">Solicitudes recientes</h2>
          </div>
          <SicsList sics={(sics ?? []) as unknown as SicRow[]} role={role} />
          {(sics?.length ?? 0) >= LIST_LIMIT && (
            <p className="border-t border-slate-100 px-6 py-3 text-sm text-slate-500">
              Mostrando las primeras {LIST_LIMIT} solicitudes de esta vista. Para encontrar otras, afiná con el buscador o los filtros.
            </p>
          )}
        </Card>
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
    <Card padding="lg">
      <p className={eyebrowClass}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${numClass} ${accent ? "text-indigo-600" : "text-slate-900"}`}>
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </Card>
  );
}

function FilterTab({
  href,
  active,
  label,
  dot,
}: {
  href: string;
  active: boolean;
  label: string;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-colors duration-fast ease-out-expo press ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
      {dot && <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-red-500" />}
    </Link>
  );
}
