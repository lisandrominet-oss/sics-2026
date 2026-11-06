import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import RemitosTabs from "@/components/RemitosTabs";
import { filterClass, numClass } from "@/lib/ui";
import { CATEGORY_LABELS, fmtQty, normSite, type RemitoCategory, type RemitoProject, type SiteStockRow } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECTIONS: { key: RemitoCategory; title: string }[] = [
  { key: "permanente", title: "Definitivo · queda en la obra" },
  { key: "retornable", title: "Retornable · es nuestro" },
  { key: "consumible", title: "Consumible" },
];

export default async function EnObraPage({ searchParams }: { searchParams: { proyecto?: string; q?: string } }) {
  const { supabase, role, projectId } = await requireRemitos();
  const { data: projectRows, error: pe } = await supabase.from("remito_projects").select("id, code, name, active").eq("active", true).order("code");
  if (pe) throw new Error(pe.message);
  const projects = (projectRows ?? []) as RemitoProject[];

  // El pañolero de proyecto ve solo el suyo; el resto elige (por defecto, el primero).
  const project = role === "panol_proyecto"
    ? projects.find((p) => p.id === projectId) ?? null
    : projects.find((p) => p.id === searchParams.proyecto) ?? projects[0] ?? null;

  let rows: SiteStockRow[] = [];
  if (project) {
    const { data, error } = await supabase.rpc("remito_site_stock", { p_project: project.id });
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as Record<string, unknown>[]).map(normSite);
  }
  const q = (searchParams.q ?? "").trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || (r.rubric ?? "").toLowerCase().includes(q));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title="Lo que hay en obra"
        description="Lo recibido menos lo que ya salió. «Sin aceptar» es lo enviado que el pañol del proyecto todavía no confirmó; «Faltante» es lo que no llegó."
      />
      <RemitosTabs active="enobra" role={role} />

      <form method="get" className="mt-5 flex flex-wrap items-center gap-2">
        {role !== "panol_proyecto" && (
          <select name="proyecto" defaultValue={project?.id ?? ""} className={filterClass} aria-label="Proyecto">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </select>
        )}
        <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Buscar pieza o rubro" aria-label="Buscar" className={`${filterClass} w-full sm:w-72`} />
        <button type="submit" className={buttonClass({ variant: "secondary" })}>Buscar</button>
        {project && <span className="text-sm text-slate-500">{project.code} · {project.name}</span>}
      </form>

      {!project ? (
        <Card className="mt-5"><EmptyState title="No tenés un proyecto asignado" description="Pedile al administrador que te asigne el proyecto en Remitos → Usuarios." /></Card>
      ) : rows.length === 0 ? (
        <Card className="mt-5"><EmptyState title={q ? "Ninguna pieza coincide" : "Todavía no hay material en este proyecto"} description={q ? undefined : "Aparece cuando el taller confirma un despacho hacia el proyecto."} /></Card>
      ) : (
        SECTIONS.map((s) => {
          const list = rows.filter((r) => r.category === s.key);
          if (list.length === 0) return null;
          return (
            <section key={s.key} className="mt-8">
              <h2 className="text-base font-semibold text-slate-900">{s.title} <span className="text-sm font-normal text-slate-500">· {list.length} {list.length === 1 ? "pieza" : "piezas distintas"}</span></h2>
              <Card padding="none" className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Pieza</th>
                      <th className="px-4 py-3 font-medium">Rubro</th>
                      <th className="px-4 py-3 text-right font-medium">Enviado</th>
                      <th className="px-4 py-3 text-right font-medium">Sin aceptar</th>
                      <th className="px-4 py-3 text-right font-medium">Faltante</th>
                      <th className="px-4 py-3 text-right font-medium">Ya salió</th>
                      <th className="px-4 py-3 text-right font-medium">En obra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.item_id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-800"><span className={`mr-2 font-medium text-slate-900 ${numClass}`}>{r.code}</span>{r.description}</td>
                        <td className="px-4 py-3 text-slate-600">{r.rubric ?? "—"}</td>
                        <td className={`px-4 py-3 text-right text-slate-600 ${numClass}`}>{fmtQty(r.sent)} {r.unit}</td>
                        <td className={`px-4 py-3 text-right ${numClass} ${r.pending > 0 ? "font-medium text-amber-900" : "text-slate-500"}`}>{r.pending > 0 ? fmtQty(r.pending) : "—"}</td>
                        <td className={`px-4 py-3 text-right ${numClass} ${r.missing > 0 ? "font-medium text-red-700" : "text-slate-500"}`}>{r.missing > 0 ? fmtQty(r.missing) : "—"}</td>
                        <td className={`px-4 py-3 text-right text-slate-600 ${numClass}`}>{r.out_qty > 0 ? fmtQty(r.out_qty) : "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium text-slate-900 ${numClass}`}>{fmtQty(r.in_site)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {s.key === "consumible" && <p className="mt-2 text-xs text-slate-500">En consumibles, «En obra» no descuenta lo que se usó: solo lo que ya salió.</p>}
              {s.key === "permanente" && <p className="mt-2 text-xs text-slate-500">{CATEGORY_LABELS.permanente}: lo definitivo queda en el proyecto y no vuelve.</p>}
            </section>
          );
        })
      )}
    </div>
  );
}
