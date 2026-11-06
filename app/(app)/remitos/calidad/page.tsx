import Link from "next/link";
import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import RemitosTabs from "@/components/RemitosTabs";
import { numClass } from "@/lib/ui";
import { CAN, KIND_SHORT, QUALITY_LABELS, QUALITY_TONES, fmtDateTime, type RemitoKind, type RemitoQuality } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";
import Badge from "@/components/ui/Badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  id: string; kind: RemitoKind; created_by_name: string | null; created_at: string;
  remito_projects: { name: string } | null;
  remito_dispatch_lines: { line_no: number; qty: number; remito_items: { code: string; description: string; quality_status: RemitoQuality } | null }[];
};

export default async function CalidadPage() {
  const { supabase, role } = await requireRemitos();
  if (!CAN.verAprobar(role)) redirect("/remitos");

  const { data, error } = await supabase
    .from("remito_dispatches")
    .select("id, kind, created_by_name, created_at, remito_projects(name), remito_dispatch_lines(line_no, qty, remito_items(code, description, quality_status))")
    .eq("status", "borrador")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const waiting = ((data ?? []) as unknown as Row[])
    .map((d) => ({ ...d, pending: d.remito_dispatch_lines.filter((l) => l.remito_items && l.remito_items.quality_status !== "aprobado") }))
    .filter((d) => d.pending.length > 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title="Despachos esperando Calidad"
        description="Lo que Logística cargó para enviar. Hasta que Calidad apruebe todos los ítems de un despacho no se puede confirmar la salida del camión."
      />
      <RemitosTabs active="calidad" role={role} />

      <div className="mt-5 space-y-4">
        {waiting.length === 0 ? (
          <Card><EmptyState title="No hay despachos esperando aprobación de Calidad" description="Los ítems nuevos se liberan desde «Ítems y Calidad»." /></Card>
        ) : (
          waiting.map((d) => (
            <Card key={d.id} title={`${KIND_SHORT[d.kind]} · ${d.remito_projects?.name ?? "—"}`}>
              <p className={`text-xs text-slate-500 ${numClass}`}>Borrador de {d.created_by_name ?? "—"} · {fmtDateTime(d.created_at)}</p>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {d.pending.map((l) => (
                  <li key={l.line_no} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-slate-800">
                      <span className={`mr-2 font-medium ${numClass}`}>{l.remito_items?.code}</span>
                      {l.remito_items?.description}
                    </span>
                    {l.remito_items && <Badge tone={QUALITY_TONES[l.remito_items.quality_status]} dot>{QUALITY_LABELS[l.remito_items.quality_status]}</Badge>}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/remitos/items" className="text-slate-900 underline underline-offset-2 hover:no-underline">Ir a liberar ítems</Link>
                <Link href={`/remitos/${d.id}`} className="text-slate-900 underline underline-offset-2 hover:no-underline">Ver borrador</Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
