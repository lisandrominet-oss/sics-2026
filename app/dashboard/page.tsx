import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import { CAN_CREATE_SIC, effectiveRole, formatAmount, formatDate, type SicStatus } from "@/lib/constants";

const PENDING_STATUSES_BY_ROLE: Record<string, SicStatus[]> = {
  compras: ["enviada", "cotizando", "aprobada", "recibida"],
  gerencia: ["pendiente_aprobacion_gerencia"],
  panol: ["orden_emitida"],
  area: ["pendiente_validacion_tecnica", "en_observacion"],
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  const supabase = createClient();
  const showPending = searchParams.filter === "mia";
  const pendingStatuses = PENDING_STATUSES_BY_ROLE[role] ?? [];

  let query = supabase
    .from("sics")
    .select("id, code, subject, status, currency, final_amount, estimated_amount, updated_at, requester_id, plants(name)")
    .order("updated_at", { ascending: false });

  if (showPending && pendingStatuses.length > 0) {
    query = query.in("status", pendingStatuses);
  }
  if (showPending && role === "area") {
    query = query.eq("requester_id", profile.id);
  }

  const { data: sics, error } = await query.limit(100);

  return (
    <div>
      <Nav
        role={role}
        realRole={profile.role}
        userId={profile.id}
        actingAsRole={profile.acting_as_role}
        fullName={profile.full_name}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Solicitudes de compra</h1>
            <div className="mt-2 flex gap-3 text-sm">
              <Link
                href="/dashboard"
                className={!showPending ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}
              >
                Todas
              </Link>
              {role !== "admin" && (
                <Link
                  href="/dashboard?filter=mia"
                  className={showPending ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}
                >
                  Pendientes de mi acción
                </Link>
              )}
            </div>
          </div>
          {CAN_CREATE_SIC.includes(role) && (
            <Link
              href="/sic/nueva"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Nueva SIC
            </Link>
          )}
        </div>

        {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Planta</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sics?.map((sic) => (
                <tr key={sic.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/sic/${sic.id}`} className="font-medium text-slate-900 hover:underline">
                      {sic.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{sic.subject}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {(sic.plants as { name: string } | null)?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatAmount(sic.final_amount ?? sic.estimated_amount, sic.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sic.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(sic.updated_at)}</td>
                </tr>
              ))}
              {sics?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No hay solicitudes para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
