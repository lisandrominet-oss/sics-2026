import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import CalidadProgress from "@/components/CalidadProgress";
import CalidadTabs from "@/components/CalidadTabs";
import { CalidadNewProjectButton } from "@/components/CalidadProjectBar";
import { IconClipboardCheck } from "@/components/icons";
import { CAN, ROLE_LABELS, loadProjects, summarizeProject, timeAgo, type CalProject } from "@/lib/calidad";
import { requireCalidad } from "@/lib/calidadServer";
import { numClass } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalidadPage() {
  const { supabase, role } = await requireCalidad();
  const { data, error } = await supabase
    .from("cal_projects")
    .select("id, code, name, active")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const projects = (data ?? []) as CalProject[];
  const loaded = await loadProjects(supabase, projects.map((p) => p.id));
  const byId = new Map(loaded.map((p) => [p.project.id, p]));
  const canEdit = CAN.editar(role);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Módulos"
        title="Calidad"
        description="Avance de obra por proyecto y sector: qué está armado, soldado, liberado, pintado, remitido y en sitio."
        actions={canEdit && <CalidadNewProjectButton />}
      />
      <CalidadTabs active="proyectos" />

      {!canEdit && <p className="mt-4 text-sm text-slate-500">{ROLE_LABELS[role]}: ves el estado actualizado, la carga la hace el supervisor de Calidad.</p>}

      {projects.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<IconClipboardCheck />}
            title="Todavía no hay proyectos"
            description={canEdit ? "Creá el primero con «Nuevo proyecto» (por ejemplo A9JM) y después sumale sus bahías." : "Cuando Calidad cargue un proyecto va a aparecer acá."}
          />
        </Card>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const pd = byId.get(p.id);
            const sum = pd ? summarizeProject(pd) : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/calidad/${p.id}`}
                  className="block rounded-xl border border-slate-200 bg-sheet p-5 transition-colors duration-base hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-500">{p.code}</p>
                      <h2 className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{p.name}</h2>
                    </div>
                    <span className={`text-2xl font-medium text-slate-900 ${numClass}`}>{sum?.pct ?? "–"}{sum?.pct != null && <span className="text-base text-slate-500">%</span>}</span>
                  </div>
                  <CalidadProgress pct={sum?.pct ?? null} className="mt-3" label={`Avance de ${p.name}`} />
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {sum && sum.bays.length > 0 ? (
                      sum.bays.map((b) => (
                        <Badge key={b.bay.id} tone="neutral" size="sm">
                          {b.bay.name}{b.pct !== null ? ` · ${b.pct}%` : ""}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">Sin sectores cargados</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Actualizado {timeAgo(sum?.lastUpdate)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
