import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { IconPlusCircle } from "@/components/icons";
import RemitosTabs from "@/components/RemitosTabs";
import { filterClass, numClass } from "@/lib/ui";
import {
  CAN, KIND_SHORT, STATUS_LABELS, STATUS_TONES, fmtDateTime,
  type RemitoKind, type RemitoStatus,
} from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  id: string; kind: RemitoKind; status: RemitoStatus; internal_no: string | null; official_no: string | null;
  dispatched_at: string; driver_name: string | null; tractor_plate: string | null; is_historical: boolean;
  remito_projects: { code: string; name: string } | null;
  remito_dispatch_lines: { count: number }[];
};

const STATUSES = Object.keys(STATUS_LABELS) as RemitoStatus[];
const KINDS = Object.keys(KIND_SHORT) as RemitoKind[];

export default async function RemitosPage({ searchParams }: { searchParams: { estado?: string; tipo?: string } }) {
  const { supabase, role } = await requireRemitos();
  const estado = STATUSES.find((s) => s === searchParams.estado);
  const tipo = KINDS.find((k) => k === searchParams.tipo);

  let query = supabase
    .from("remito_dispatches")
    .select(
      "id, kind, status, internal_no, official_no, dispatched_at, driver_name, tractor_plate, is_historical, remito_projects(code, name), remito_dispatch_lines(count)"
    )
    .order("dispatched_at", { ascending: false })
    .limit(300);
  if (estado) query = query.eq("status", estado);
  if (tipo) query = query.eq("kind", tipo);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Módulos"
        title="Remitos y Despachos"
        description="Armado de camiones a obra: ítems aprobados por Calidad, fotos y firma de salida, remito impreso."
        actions={
          CAN.armarDespachos(role) && (
            <Link href="/remitos/nuevo" className={buttonClass()}>
              <IconPlusCircle className="h-4 w-4" />
              Nuevo despacho
            </Link>
          )
        }
      />
      <RemitosTabs active="despachos" role={role} />

      <form method="get" className="mt-5 flex flex-wrap items-center gap-2">
        <select name="estado" defaultValue={estado ?? ""} className={filterClass} aria-label="Estado">
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className={filterClass} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_SHORT[k]}</option>)}
        </select>
        <button type="submit" className={buttonClass({ variant: "secondary" })}>Filtrar</button>
      </form>

      <Card padding="none" className="mt-4 overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState
            title="Todavía no hay despachos"
            description={CAN.armarDespachos(role) ? "Armá el primero desde «Nuevo despacho»." : "Cuando Logística confirme una salida va a aparecer acá."}
          />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">N° interno</th>
                <th className="px-4 py-3 font-medium">N° oficial</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Chofer / patente</th>
                <th className="px-4 py-3 text-right font-medium">Ítems</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={`px-4 py-3 font-medium text-slate-900 ${numClass}`}>
                    {r.internal_no ?? <span className="font-normal text-slate-500">sin asignar</span>}
                    {r.is_historical && <span className="ml-1.5 text-xs font-normal text-slate-500">histórico</span>}
                  </td>
                  <td className={`px-4 py-3 text-slate-600 ${numClass}`}>{r.official_no ?? "—"}</td>
                  <td className={`px-4 py-3 text-slate-600 ${numClass}`}>{fmtDateTime(r.dispatched_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.remito_projects ? `${r.remito_projects.name}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{KIND_SHORT[r.kind]}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.driver_name ?? "—"}
                    {r.tractor_plate && <span className={`block text-xs text-slate-500 ${numClass}`}>{r.tractor_plate}</span>}
                  </td>
                  <td className={`px-4 py-3 text-right text-slate-600 ${numClass}`}>{r.remito_dispatch_lines?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONES[r.status]} dot>{STATUS_LABELS[r.status]}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/remitos/${r.id}`} className="text-sm text-slate-900 underline underline-offset-2 hover:no-underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
