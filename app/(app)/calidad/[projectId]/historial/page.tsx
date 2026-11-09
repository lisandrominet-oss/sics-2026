import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { fetchIn, fmtDateTime, type CalEvent } from "@/lib/calidad";
import { requireCalidad } from "@/lib/calidadServer";
import { numClass } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Change = { item?: string; etapa?: string; de?: number; a?: number };

function describe(ev: CalEvent, names: Map<string, string>): { title: string; lines: string[] } {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  const nm = (v: unknown) => (typeof v === "string" && v ? `«${v}»` : "");
  const target = names.get(ev.entity_id);
  const on = target ? `«${target}»` : "";
  switch (ev.event_type) {
    case "avance": {
      const changes = (Array.isArray(d.cambios) ? d.cambios : []) as Change[];
      return {
        title: `Cargó avance en ${on || "un grupo"}`,
        lines: changes.map((c) => `${c.item ?? "Elemento"} · ${c.etapa ?? "etapa"}: ${c.de ?? 0} → ${c.a ?? 0}`),
      };
    }
    case "proyecto_creado": return { title: `Creó el proyecto ${nm(d.name)}`, lines: [] };
    case "proyecto_editado": return { title: `Editó el proyecto ${nm(d.name)}`, lines: [] };
    case "sector_creado": return { title: `Creó el sector ${nm(d.name)}`, lines: [] };
    case "sector_editado": return { title: `Editó el sector ${nm(d.name)}`, lines: [d.responsible ? `Responsable: ${String(d.responsible)}` : "", d.due_date ? `Compromiso: ${String(d.due_date)}` : ""].filter(Boolean) };
    case "grupo_creado": return { title: `Creó el grupo ${nm(d.name)}`, lines: d.plantilla ? [`Plantilla: ${String(d.plantilla)}`] : [] };
    case "grupo_editado": return { title: `Editó el grupo ${nm(d.name)}`, lines: [] };
    case "etapas_editadas": return { title: `Cambió las etapas de ${on || "un grupo"}`, lines: Array.isArray(d.etapas) ? [(d.etapas as string[]).join(" → ")] : [] };
    case "elemento_creado": return { title: `Creó el elemento ${nm(d.name)}`, lines: d.total != null ? [`Total: ${String(d.total)}`] : [] };
    case "elemento_editado": return { title: `Editó el elemento ${nm(d.name)}`, lines: d.total != null ? [`Total: ${String(d.total)}`] : [] };
    case "archivado": return { title: `Archivó ${on || "un elemento"}`, lines: [] };
    case "reactivado": return { title: `Reactivó ${on || "un elemento"}`, lines: [] };
    case "novedad": return { title: "Agregó una novedad", lines: ev.note ? [ev.note] : [] };
    case "novedad_borrada": return { title: "Borró una novedad", lines: ev.note ? [ev.note] : [] };
    default: return { title: ev.event_type.replace(/_/g, " "), lines: [] };
  }
}

export default async function CalidadHistorialPage({ params }: { params: { projectId: string } }) {
  if (!UUID.test(params.projectId)) notFound();
  const { supabase } = await requireCalidad();
  const { data: proj } = await supabase.from("cal_projects").select("id, code, name").eq("id", params.projectId).maybeSingle();
  if (!proj) notFound();

  const { data, error } = await supabase
    .from("cal_events")
    .select("id, entity, entity_id, event_type, actor_name, note, data, created_at")
    .eq("project_id", params.projectId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as CalEvent[];

  // Nombres de lo que se tocó (aunque ya esté archivado).
  const idsOf = (entity: string) => Array.from(new Set(events.filter((e) => e.entity === entity).map((e) => e.entity_id)));
  const [groups, bays, items] = await Promise.all([
    fetchIn<{ id: string; name: string }>(idsOf("group"), (ids, f, t) => supabase.from("cal_groups").select("id, name").in("id", ids).range(f, t)),
    fetchIn<{ id: string; name: string }>(idsOf("bay"), (ids, f, t) => supabase.from("cal_bays").select("id, name").in("id", ids).range(f, t)),
    fetchIn<{ id: string; name: string }>(idsOf("item"), (ids, f, t) => supabase.from("cal_items").select("id, name").in("id", ids).range(f, t)),
  ]);
  const names = new Map([...groups, ...bays, ...items].map((r) => [r.id, r.name]));
  names.set(proj.id, `${proj.code} ${proj.name}`);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={`Calidad · ${proj.code}`}
        title="Historial"
        description={`Quién cambió qué y cuándo en ${proj.name} (últimos ${events.length}).`}
      />
      <p className="mt-4">
        <Link href={`/calidad/${proj.id}`} className="text-sm text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">← Volver al proyecto</Link>
      </p>

      <Card padding="none" className="mt-4">
        {events.length === 0 ? (
          <EmptyState title="Todavía no hay movimientos" description="Cada carga de avance y cada cambio de estructura queda registrado acá." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((ev) => {
              const { title, lines } = describe(ev, names);
              return (
                <li key={ev.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="text-sm font-medium text-slate-900">{title}</p>
                    <p className={`text-xs text-slate-500 ${numClass}`}>{fmtDateTime(ev.created_at)} · {ev.actor_name ?? "—"}</p>
                  </div>
                  {lines.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                      {lines.slice(0, 40).map((l, i) => <li key={i} className="[overflow-wrap:anywhere]">{l}</li>)}
                      {lines.length > 40 && <li className="text-xs text-slate-500">y {lines.length - 40} más</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
