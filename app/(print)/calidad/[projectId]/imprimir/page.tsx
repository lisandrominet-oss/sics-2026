import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "../../calidad-print.css";
import PrintBar from "./PrintBar";
import { countKey, fmtDateTime, fmtShortDate, groupProgress, loadProjects, type CalNote } from "@/lib/calidad";
import { requireCalidad } from "@/lib/calidadServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minuta de reunión", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Minuta de reunión (registro RSI GC 21-1) con el estado actual: una fila por sector, con sus grupos,
// las novedades más recientes, el responsable y la fecha compromiso.
export default async function ImprimirMinutaPage({ params, searchParams }: { params: { projectId: string }; searchParams: { bahia?: string } }) {
  if (!UUID.test(params.projectId)) notFound();
  const { supabase, profile } = await requireCalidad();
  const [pd] = await loadProjects(supabase, [params.projectId]);
  if (!pd || !pd.project.active) notFound();

  const only = searchParams.bahia && UUID.test(searchParams.bahia) ? searchParams.bahia : null;
  const bays = only ? pd.bays.filter((b) => b.id === only) : pd.bays;
  if (only && bays.length === 0) notFound();

  const { data: noteRows, error } = bays.length
    ? await supabase
        .from("cal_notes")
        .select("id, bay_id, group_id, note_date, body, created_by_name, created_at")
        .in("bay_id", bays.map((b) => b.id))
        .order("note_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(400)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const notes = (noteRows ?? []) as CalNote[];

  const emitted = `Emitido el ${fmtDateTime(new Date().toISOString())} · ${profile.full_name ?? profile.email ?? ""}`;

  return (
    <div className="cal-root">
      <PrintBar projectId={pd.project.id} bays={pd.bays.map((b) => ({ id: b.id, name: b.name }))} current={only} />
      <section className="cal-page">
        <table className="cal-head">
          <tbody>
            <tr>
              <td className="logo">Servicios Industriales</td>
              <td className="reg">
                Registro:
                <strong>MINUTA DE REUNIÓN</strong>
                <span>Proyecto {pd.project.code} · {pd.project.name}</span>
              </td>
              <td className="cod">
                RSI GC 21 – 1
                <small>{fmtShortDate(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }))}</small>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="cal-main">
          <thead>
            <tr>
              <th className="n">No. Ítem</th>
              <th>Tema / Descripción / Acuerdo</th>
              <th className="resp">Responsable</th>
              <th className="fecha">Fecha compromiso</th>
            </tr>
          </thead>
          <tbody>
            {bays.map((bay, i) => {
              const groups = pd.groupsByBay.get(bay.id) ?? [];
              const bayNotes = notes.filter((n) => n.bay_id === bay.id).slice(0, 12);
              return (
                <tr key={bay.id}>
                  <td className="n">{i + 1}</td>
                  <td>
                    <p className="cal-bay">{bay.name}</p>
                    {groups.length === 0 && <p>Sin grupos cargados.</p>}
                    {groups.map((g) => {
                      const prog = groupProgress(g);
                      return (
                        <div key={g.group.id}>
                          <p className="cal-grp">{g.group.name.toUpperCase()}</p>
                          <table className="cal-tbl">
                            <thead>
                              <tr>
                                <th className="l">Elemento</th>
                                <th>Cantidad</th>
                                {g.stages.map((s) => <th key={s.id}>{s.name}</th>)}
                                <th>Compromiso</th>
                                <th>Fecha en sitio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map((it) => (
                                <tr key={it.id}>
                                  <td className="l">{it.name}</td>
                                  <td className="done">{it.total}</td>
                                  {g.stages.map((s) => {
                                    const q = g.counts[countKey(it.id, s.id)] ?? 0;
                                    return <td key={s.id} className={it.total > 0 && q >= it.total ? "done" : ""}>{q === 0 ? "" : q}</td>;
                                  })}
                                  <td>{it.due_date ? fmtShortDate(it.due_date) : ""}</td>
                                  <td className="done">{it.completed_at ? fmtShortDate(it.completed_at) : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td className="l">TOTAL</td>
                                <td>{prog.totalQty}</td>
                                {g.stages.map((s) => <td key={s.id}>{prog.byStage.get(s.id) ?? 0}</td>)}
                                <td />
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    })}
                    {bayNotes.length > 0 && (
                      <ul className="cal-notes">
                        {bayNotes.map((n) => (
                          <li key={n.id}>
                            {fmtShortDate(n.note_date)}: {n.body}
                            {n.created_by_name ? ` (${n.created_by_name})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="resp">{bay.responsible ?? ""}</td>
                  <td className="fecha">{bay.due_date ? fmtShortDate(bay.due_date) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="cal-foot">{emitted}</p>
      </section>
    </div>
  );
}
