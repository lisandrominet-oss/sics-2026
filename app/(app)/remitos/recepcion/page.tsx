import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import RemitosTabs from "@/components/RemitosTabs";
import { numClass } from "@/lib/ui";
import { CAN, KIND_SHORT, RECEPTION_LABELS, daysSince, fmtDateTime, type RemitoKind, type RemitoReception } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PendingRow = {
  id: string; kind: RemitoKind; internal_no: string | null; dispatched_at: string; reason: string | null;
  remito_projects: { name: string } | null;
  remito_dispatch_lines: { count: number }[];
};
type DoneRow = RemitoReception & { remito_dispatches: { id: string; internal_no: string | null; dispatched_at: string } | null };

export default async function RecepcionPage() {
  const { supabase, role } = await requireRemitos();

  // Contadores exactos + los pendientes (los más viejos primero) + las últimas recepciones: así el porcentaje y los
  // pendientes no dependen de un tope de filas.
  const [totalRes, doneCountRes, pendingRes, doneRes] = await Promise.all([
    supabase.from("remito_dispatches").select("id", { count: "exact", head: true }).eq("status", "confirmado"),
    supabase.from("remito_receptions").select("dispatch_id", { count: "exact", head: true }),
    supabase
      .from("remito_dispatches")
      .select("id, kind, internal_no, dispatched_at, reason, remito_projects(name), remito_dispatch_lines(count), remito_receptions!left(dispatch_id)")
      .eq("status", "confirmado")
      .is("remito_receptions", null)
      .order("dispatched_at", { ascending: true })
      .limit(300),
    supabase
      .from("remito_receptions")
      .select("dispatch_id, status, received_by_name, received_at, note, remito_dispatches(id, internal_no, dispatched_at)")
      .order("received_at", { ascending: false })
      .limit(100),
  ]);
  for (const r of [totalRes, doneCountRes, pendingRes, doneRes]) if (r.error) throw new Error(r.error.message);

  const total = totalRes.count ?? 0;
  const doneCount = doneCountRes.count ?? 0;
  const pending = (pendingRes.data ?? []) as unknown as PendingRow[];
  const done = ((doneRes.data ?? []) as unknown as DoneRow[]).filter((r) => r.remito_dispatches);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const canReceive = CAN.recibir(role);

  // Quién recibió y cuánto tardó, en promedio.
  const byPerson = new Map<string, { n: number; days: number; diff: number }>();
  for (const r of done) {
    const who = r.received_by_name ?? "—";
    const acc = byPerson.get(who) ?? { n: 0, days: 0, diff: 0 };
    acc.n += 1;
    acc.days += Math.max(0, Math.round((new Date(r.received_at).getTime() - new Date(r.remito_dispatches!.dispatched_at).getTime()) / 86_400_000));
    if (r.status === "con_diferencias") acc.diff += 1;
    byPerson.set(who, acc);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title="Recepción en obra"
        description={canReceive
          ? "Lo que el taller te envió. Confirmá qué llegó: lo que no llegó o llegó de menos queda registrado y corrige el stock en obra."
          : "Qué parte de lo enviado ya aceptó el pañol del proyecto, quién lo aceptó y qué falta."}
      />
      <RemitosTabs active="recepcion" role={role} />

      <Card className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`text-3xl font-medium text-slate-900 ${numClass}`}>{pct}%</p>
            <p className="text-sm text-slate-500">de los envíos ya fueron recibidos</p>
          </div>
          <p className={`text-sm text-slate-600 ${numClass}`}>Faltan recibir {Math.max(0, total - doneCount)} de {total} envíos</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la recepción">
          <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <h2 className="mt-8 text-base font-semibold text-slate-900">Sin recibir · los que más llevan esperando, primero</h2>
      <Card padding="none" className="mt-3 overflow-x-auto">
        {pending.length === 0 ? (
          <EmptyState title={total === 0 ? "Todavía no hay envíos" : "No hay nada pendiente de recibir"} description={total === 0 ? "Cuando el taller confirme una salida hacia tu proyecto, aparece acá." : undefined} />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Envío</th>
                <th className="px-4 py-3 font-medium">Enviado</th>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 text-right font-medium">Líneas</th>
                <th className="px-4 py-3 text-right font-medium">Días esperando</th>
                <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={`px-4 py-3 font-medium text-slate-900 ${numClass}`}>{r.internal_no ?? "—"}</td>
                  <td className={`px-4 py-3 text-slate-600 ${numClass}`}>{fmtDateTime(r.dispatched_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.remito_projects?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.reason ?? KIND_SHORT[r.kind]}</td>
                  <td className={`px-4 py-3 text-right text-slate-600 ${numClass}`}>{r.remito_dispatch_lines?.[0]?.count ?? 0}</td>
                  <td className={`px-4 py-3 text-right text-slate-700 ${numClass}`}>{daysSince(r.dispatched_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/remitos/${r.id}`} className="text-sm text-slate-900 underline underline-offset-2 hover:no-underline">
                      {canReceive ? "Recibir" : "Abrir"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {byPerson.size > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold text-slate-900">Quién recibió</h2>
          <Card padding="none" className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Persona</th>
                  <th className="px-4 py-3 text-right font-medium">Envíos recibidos</th>
                  <th className="px-4 py-3 text-right font-medium">Tardó en promedio (días)</th>
                  <th className="px-4 py-3 text-right font-medium">Con diferencias</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byPerson.entries()).map(([who, a]) => (
                  <tr key={who} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800">{who}</td>
                    <td className={`px-4 py-3 text-right text-slate-700 ${numClass}`}>{a.n}</td>
                    <td className={`px-4 py-3 text-right text-slate-700 ${numClass}`}>{Math.round(a.days / a.n)}</td>
                    <td className={`px-4 py-3 text-right text-slate-700 ${numClass}`}>{a.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mt-8 text-base font-semibold text-slate-900">Recibidos <span className="text-sm font-normal text-slate-500">· los últimos {done.length}</span></h2>
          <Card padding="none" className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Envío</th>
                  <th className="px-4 py-3 font-medium">Enviado</th>
                  <th className="px-4 py-3 font-medium">Recibido por</th>
                  <th className="px-4 py-3 font-medium">Recibido el</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.dispatch_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className={`px-4 py-3 font-medium text-slate-900 ${numClass}`}>{r.remito_dispatches!.internal_no ?? "—"}</td>
                    <td className={`px-4 py-3 text-slate-600 ${numClass}`}>{fmtDateTime(r.remito_dispatches!.dispatched_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.received_by_name ?? "—"}</td>
                    <td className={`px-4 py-3 text-slate-600 ${numClass}`}>{fmtDateTime(r.received_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.status === "aceptado" ? "success" : "warning"} dot>{RECEPTION_LABELS[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/remitos/${r.dispatch_id}`} className="text-sm text-slate-900 underline underline-offset-2 hover:no-underline">Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
