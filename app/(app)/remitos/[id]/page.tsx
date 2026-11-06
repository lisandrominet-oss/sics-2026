import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import InfoItem from "@/components/ui/InfoItem";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import RemitosTabs from "@/components/RemitosTabs";
import RemitoDispatchEditor, { type EditorFile, type EditorLine } from "@/components/RemitoDispatchEditor";
import RemitoDetailActions from "@/components/RemitoDetailActions";
import RemitoReceiveForm from "@/components/RemitoReceiveForm";
import { numClass } from "@/lib/ui";
import {
  CAN, CATEGORY_LABELS, EVENT_LABELS, FILE_KIND_LABELS, KIND_LABELS, REMITO_BUCKET, STATUS_LABELS, STATUS_TONES,
  RECEPTION_LABELS, fmtDate, fmtDateTime, fmtQty, normItem, normLine,
  type RemitoDispatch, type RemitoEvent, type RemitoFile, type RemitoItem, type RemitoLine, type RemitoProject, type RemitoReception,
} from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_COLS = "id, code, description, rubric, unit, category, stock, quality_status, quality_by_name, quality_at, active";

export default async function RemitoDetailPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const { supabase, role } = await requireRemitos();

  const { data: dRow, error } = await supabase.from("remito_dispatches").select("*").eq("id", params.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!dRow) notFound();
  const dispatch = dRow as RemitoDispatch;

  const [{ data: lineRows }, { data: fileRows }, { data: eventRows }, { data: projectRows }, { data: receptionRow }] = await Promise.all([
    supabase.from("remito_dispatch_lines").select("*").eq("dispatch_id", dispatch.id).order("line_no"),
    supabase.from("remito_files").select("*").eq("dispatch_id", dispatch.id).order("created_at"),
    supabase.from("remito_events").select("id, event_type, actor_name, note, data, created_at").eq("entity", "dispatch").eq("entity_id", dispatch.id).order("created_at", { ascending: false }),
    supabase.from("remito_projects").select("id, code, name, active"),
    supabase.from("remito_receptions").select("dispatch_id, status, received_by_name, received_at, note").eq("dispatch_id", dispatch.id).maybeSingle(),
  ]);
  const reception = (receptionRow ?? null) as RemitoReception | null;
  const lines = (lineRows ?? []).map(normLine) as RemitoLine[];
  const files = (fileRows ?? []) as RemitoFile[];
  const events = (eventRows ?? []) as RemitoEvent[];
  const projects = (projectRows ?? []) as RemitoProject[];
  const project = projects.find((p) => p.id === dispatch.project_id) ?? null;

  const itemIds = Array.from(new Set(lines.map((l) => l.item_id)));
  const { data: itemRows } = itemIds.length
    ? await supabase.from("remito_items").select(ITEM_COLS).in("id", itemIds)
    : { data: [] as Record<string, unknown>[] };
  const lineItems = (itemRows ?? []).map(normItem) as RemitoItem[];
  const itemById = new Map(lineItems.map((i) => [i.id, i]));

  // Vínculos temporales (1 h) a las fotos y la firma del bucket privado.
  const paths = [...files.map((f) => f.path), ...(dispatch.signature_path ? [dispatch.signature_path] : [])];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(REMITO_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const filesWithUrl: EditorFile[] = files.map((f) => ({ ...f, url: urls.get(f.path) ?? null }));
  const signatureUrl = dispatch.signature_path ? urls.get(dispatch.signature_path) ?? null : null;

  // Borrador y con permiso de armar: se abre el editor.
  if (dispatch.status === "borrador" && CAN.armarDespachos(role)) {
    const { data: approved } = await supabase.from("remito_items").select(ITEM_COLS).eq("active", true).eq("quality_status", "aprobado").order("code");
    const merged = new Map<string, RemitoItem>();
    for (const i of (approved ?? []).map(normItem)) merged.set(i.id, i);
    for (const i of lineItems) if (!merged.has(i.id)) merged.set(i.id, i);
    const editorLines: EditorLine[] = lines.map((l) => ({
      key: l.id, item_id: l.item_id, qty: String(l.qty), condition: l.condition,
      est_return_date: l.est_return_date ?? "", official_no: l.official_no ?? "", notes: l.notes ?? "",
    }));
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Remitos y Despachos"
          title={<>Despacho en borrador <Badge tone={STATUS_TONES.borrador} dot className="ml-2 align-middle">{STATUS_LABELS.borrador}</Badge></>}
          description="Completá la carga y los candados de salida. El número interno se asigna al confirmar."
        />
        <RemitosTabs active={null} role={role} />
        <RemitoDispatchEditor
          projects={projects.filter((p) => p.active || p.id === dispatch.project_id)}
          items={Array.from(merged.values())}
          dispatch={dispatch}
          lines={editorLines}
          files={filesWithUrl}
          signatureUrl={signatureUrl}
        />
      </div>
    );
  }

  const title = dispatch.internal_no ?? "Despacho sin número";
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title={<>{title} <Badge tone={STATUS_TONES[dispatch.status]} dot className="ml-2 align-middle">{STATUS_LABELS[dispatch.status]}</Badge>{dispatch.is_historical && <Badge tone="muted" className="ml-2 align-middle">Carga histórica</Badge>}</>}
        actions={
          dispatch.status !== "borrador" && (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/remitos/${dispatch.id}/imprimir`} target="_blank" className={buttonClass()}>Imprimir remito</Link>
              <Link href={`/remitos/${dispatch.id}/imprimir?dup=1`} target="_blank" className={buttonClass({ variant: "secondary" })}>Imprimir con duplicado</Link>
              <Link href="/remitos" className={buttonClass({ variant: "ghost" })}>Volver</Link>
            </div>
          )
        }
      />
      <RemitosTabs active={null} role={role} />

      <div className="mt-5 space-y-6">
        <Card title="Cabecera">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem definition label="Tipo" value={KIND_LABELS[dispatch.kind]} />
            <InfoItem definition label="N° interno" value={dispatch.internal_no ?? "sin asignar"} />
            <InfoItem definition label="N° remito oficial" value={dispatch.official_no ?? "—"} />
            <InfoItem definition label="Proyecto" value={project ? `${project.code} · ${project.name}` : "—"} />
            <InfoItem definition label="Despacho" value={fmtDateTime(dispatch.dispatched_at)} />
            <InfoItem definition label="Motivo" value={dispatch.reason ?? "—"} />
            <InfoItem definition label="Empresa de flete" value={dispatch.carrier_company ?? "—"} />
            <InfoItem definition label="Chofer" value={[dispatch.driver_name, dispatch.driver_dni && `DNI ${dispatch.driver_dni}`].filter(Boolean).join(" · ") || "—"} />
            <InfoItem definition label="Patentes" value={[dispatch.tractor_plate && `Tractor ${dispatch.tractor_plate}`, dispatch.trailer_plate && `Acoplado ${dispatch.trailer_plate}`].filter(Boolean).join(" · ") || "—"} />
            <InfoItem definition label="Observaciones" value={dispatch.notes ?? "—"} />
            <InfoItem definition label="Creado" value={`${dispatch.created_by_name ?? "—"} · ${fmtDateTime(dispatch.created_at)}`} />
            {dispatch.confirmed_at && <InfoItem definition label="Confirmado" value={`${dispatch.confirmed_by_name ?? "—"} · ${fmtDateTime(dispatch.confirmed_at)}`} />}
            {dispatch.cancelled_at && <InfoItem definition label="Anulado" value={`${dispatch.cancelled_by_name ?? "—"} · ${fmtDateTime(dispatch.cancelled_at)}${dispatch.cancel_reason ? ` · ${dispatch.cancel_reason}` : ""}`} />}
          </dl>
          <div className="mt-4"><RemitoDetailActions dispatch={dispatch} role={role} /></div>
        </Card>

        {dispatch.status === "confirmado" && !reception && CAN.recibir(role) && (
          <RemitoReceiveForm
            dispatchId={dispatch.id}
            lines={lines.map((l) => ({ id: l.id, code: itemById.get(l.item_id)?.code ?? "?", description: itemById.get(l.item_id)?.description ?? "—", unit: itemById.get(l.item_id)?.unit ?? "un", qty: l.qty }))}
          />
        )}
        {dispatch.status === "confirmado" && !reception && !CAN.recibir(role) && (
          <Card title="Recepción en obra"><p className="text-sm text-slate-600">Todavía no fue recibido por el pañol del proyecto.</p></Card>
        )}
        {reception && (
          <Card title="Recepción en obra">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={reception.status === "aceptado" ? "success" : "warning"} dot>{RECEPTION_LABELS[reception.status]}</Badge>
              <span className={`text-sm text-slate-600 ${numClass}`}>{reception.received_by_name ?? "—"} · {fmtDateTime(reception.received_at)}</span>
            </div>
            {reception.note && <p className="mt-2 text-sm text-slate-700">{reception.note}</p>}
          </Card>
        )}

        <Card title="Detalle de carga">
          <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 text-right font-medium">Cant.</th>
                {reception && <th className="px-4 py-2 text-right font-medium">Recibido</th>}
                <th className="px-4 py-2 font-medium">Condición</th>
                <th className="px-4 py-2 font-medium">Devolución est.</th>
                <th className="px-4 py-2 font-medium">Remito oficial</th>
                <th className="px-4 py-2 font-medium">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const it = itemById.get(l.item_id);
                return (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <td className={`px-4 py-2 font-medium text-slate-900 ${numClass}`}>{it?.code ?? "?"}</td>
                    <td className="px-4 py-2 text-slate-700">{it?.description ?? "—"}</td>
                    <td className={`px-4 py-2 text-right text-slate-700 ${numClass}`}>{fmtQty(l.qty)} {it?.unit}</td>
                    {reception && (
                      <td className={`px-4 py-2 text-right ${numClass} ${l.received_qty !== null && l.received_qty !== l.qty ? "font-medium text-amber-900" : "text-slate-700"}`}>
                        {l.received_qty === null ? "—" : fmtQty(l.received_qty)}
                        {l.received_note && <span className="block text-xs font-normal text-slate-500">{l.received_note}</span>}
                      </td>
                    )}
                    <td className="px-4 py-2 text-slate-600">{CATEGORY_LABELS[l.condition]}</td>
                    <td className={`px-4 py-2 text-slate-600 ${numClass}`}>{fmtDate(l.est_return_date)}</td>
                    <td className={`px-4 py-2 text-slate-600 ${numClass}`}>{l.official_no ?? "sin remito oficial"}</td>
                    <td className="px-4 py-2 text-slate-600">{l.notes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>

        <Card title="Archivos">
          {filesWithUrl.length === 0 && !signatureUrl ? (
            <EmptyState size="sm" title="Sin archivos adjuntos." />
          ) : (
            <div className="flex flex-wrap gap-4">
              {filesWithUrl.map((f) => (
                <figure key={f.id} className="w-28">
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={FILE_KIND_LABELS[f.kind]} className="h-28 w-28 rounded-lg border border-slate-200 object-cover" />
                    </a>
                  ) : <div className="h-28 w-28 rounded-lg border border-slate-200" />}
                  <figcaption className="mt-1 text-xs text-slate-500">{FILE_KIND_LABELS[f.kind]}</figcaption>
                </figure>
              ))}
              {signatureUrl && (
                <figure className="w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatureUrl} alt="Firma del chofer" className="h-28 w-28 rounded-lg border border-slate-200 bg-white object-contain" />
                  <figcaption className="mt-1 text-xs text-slate-500">Firma del chofer</figcaption>
                </figure>
              )}
            </div>
          )}
          {dispatch.status === "confirmado" && !dispatch.official_no && CAN.armarDespachos(role) && (
            <p className="mt-3 text-xs text-slate-500">Este despacho todavía no tiene N° de remito oficial. Asignalo y subí la foto del remito firmado.</p>
          )}
        </Card>

        <Card title="Historial">
          {events.length === 0 ? (
            <EmptyState size="sm" title="Sin movimientos." />
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-slate-800">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                    {e.note && <span className="text-slate-500"> · {e.note}</span>}
                  </span>
                  <span className={`text-xs text-slate-500 ${numClass}`}>{e.actor_name ?? "—"} · {fmtDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
