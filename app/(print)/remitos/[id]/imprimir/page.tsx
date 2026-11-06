import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../../remito-print.css";
import PrintBar from "./PrintBar";
import {
  REMITO_BUCKET, REMITO_COMPANY_NAME, fmtDateTime, fmtQty, normItem, normLine,
  type RemitoDispatch, type RemitoItem, type RemitoLine, type RemitoProject,
} from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Remito", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_ROWS = 25;

function obs(line: RemitoLine): string {
  const tag = line.condition === "retornable" ? "RETORNABLE" : line.condition === "consumible" ? "Consumible de obra" : "Permanente";
  return [line.notes, tag].filter(Boolean).join(" — ");
}

export default async function ImprimirRemitoPage({ params, searchParams }: { params: { id: string }; searchParams: { dup?: string } }) {
  if (!UUID.test(params.id)) notFound();
  const { supabase, profile } = await requireRemitos();

  const { data: dRow } = await supabase.from("remito_dispatches").select("*").eq("id", params.id).maybeSingle();
  if (!dRow) notFound();
  const d = dRow as RemitoDispatch;

  const [{ data: lineRows }, { data: pRow }] = await Promise.all([
    supabase.from("remito_dispatch_lines").select("*").eq("dispatch_id", d.id).order("line_no"),
    supabase.from("remito_projects").select("id, code, name, active").eq("id", d.project_id).maybeSingle(),
  ]);
  const lines = (lineRows ?? []).map(normLine) as RemitoLine[];
  const project = pRow as RemitoProject | null;
  const ids = Array.from(new Set(lines.map((l) => l.item_id)));
  const { data: itemRows } = ids.length
    ? await supabase.from("remito_items").select("id, code, description, rubric, unit, category, stock, quality_status, quality_by_name, quality_at, active").in("id", ids)
    : { data: [] as Record<string, unknown>[] };
  const items = new Map(((itemRows ?? []).map(normItem) as RemitoItem[]).map((i) => [i.id, i]));

  let signatureUrl: string | null = null;
  if (d.signature_path) {
    const { data } = await supabase.storage.from(REMITO_BUCKET).createSignedUrl(d.signature_path, 3600);
    signatureUrl = data?.signedUrl ?? null;
  }

  const dup = searchParams.dup === "1";
  const emitted = `Emitido el ${fmtDateTime(new Date().toISOString())} · ${profile.full_name ?? profile.email ?? ""}`;
  const blanks = Math.max(0, MIN_ROWS - lines.length);
  const copies = dup ? ["Original", "Duplicado"] : ["Original"];

  return (
    <div className="rem-root">
      <PrintBar dup={dup} id={d.id} />
      {copies.map((copy) => (
        <section key={copy} className="rem-page">
          <div className="rem-head">
            <div className="rem-logo">{REMITO_COMPANY_NAME}</div>
            <div>
              {dup && <span className="rem-dup">{copy.toUpperCase()}</span>}
              {d.status === "anulado" && <span className="rem-dup rem-void">ANULADO</span>}
              <h1 className="rem-title">REMITO DE INGRESO DE EQUIPOS, HERRAMIENTAS Y MATERIALES</h1>
              <div className="rem-company">{REMITO_COMPANY_NAME}</div>
            </div>
          </div>

          <table className="rem-box">
            <tbody>
              <tr>
                <td className="k">Remito N°</td>
                <td className="num">{d.internal_no ?? (d.status === "borrador" ? "BORRADOR" : "SIN ASIGNAR")}</td>
                <td className="k">Fecha</td>
                <td>{fmtDateTime(d.dispatched_at)}</td>
              </tr>
              <tr>
                <td className="k">Destino</td>
                <td>{project ? `Proyecto ${project.code} ${project.name}` : "—"}</td>
                <td className="k">Motivo</td>
                <td>{d.reason ?? ""}</td>
              </tr>
            </tbody>
          </table>

          <div className="rem-sub">Detalle de elementos transportados</div>
          <table className="rem-items">
            <thead>
              <tr>
                <th className="c-sec">Sec.</th>
                <th className="c-rubro">Rubro</th>
                <th>Descripción</th>
                <th className="c-qty">Cantidad</th>
                <th className="c-obs">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const it = items.get(l.item_id);
                return (
                  <tr key={l.id}>
                    <td className="c-sec">{l.line_no}</td>
                    <td>{it?.rubric ?? ""}</td>
                    <td>{it?.description ?? ""}</td>
                    <td className="c-qty">{fmtQty(l.qty)}</td>
                    <td>{obs(l)}</td>
                  </tr>
                );
              })}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={`b${i}`}>
                  <td className="c-sec">&nbsp;</td><td /><td /><td /><td />
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rem-note">
            <strong>Observación:</strong> Los elementos detallados en el presente remito ingresan al proyecto para uso exclusivo en tareas operativas. {REMITO_COMPANY_NAME}
            {d.notes && <> · {d.notes}</>}
          </div>

          <div className="rem-sign">
            <div>
              <h4>Entrega · Logística</h4>
              <p><strong>Nombre y apellido:</strong> {d.confirmed_by_name ?? d.created_by_name ?? ""}</p>
              <p><strong>Empresa:</strong> {REMITO_COMPANY_NAME}</p>
              <p><strong>Firma y aclaración:</strong></p>
            </div>
            <div>
              <h4>Transporte · Chofer</h4>
              <p><strong>Chofer:</strong> {[d.driver_name, d.driver_dni && `DNI ${d.driver_dni}`].filter(Boolean).join(" · ")}</p>
              <p><strong>Flete:</strong> {d.carrier_company ?? "—"} · <strong>Tractor:</strong> {d.tractor_plate ?? "—"}{d.trailer_plate && <> · <strong>Acoplado:</strong> {d.trailer_plate}</>}</p>
              <p><strong>Firma y aclaración:</strong></p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {signatureUrl && <img src={signatureUrl} alt="Firma del chofer" />}
            </div>
            <div>
              <h4>Recepción en proyecto</h4>
              <p><strong>Nombre y apellido:</strong></p>
              <p><strong>Fecha recepción:</strong> ____ / ____ / ________</p>
              <p><strong>Firma y aclaración:</strong></p>
            </div>
          </div>
          <div className="rem-foot">{emitted}{dup ? ` · ${copy}` : ""}</div>
        </section>
      ))}
    </div>
  );
}
