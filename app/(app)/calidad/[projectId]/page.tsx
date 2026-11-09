import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import CalidadProgress from "@/components/CalidadProgress";
import CalidadGroupTable from "@/components/CalidadGroupTable";
import CalidadNotes from "@/components/CalidadNotes";
import { CalidadProjectBar } from "@/components/CalidadProjectBar";
import { IconClipboardCheck } from "@/components/icons";
import {
  CAN, ROLE_LABELS, fmtShortDate, loadProjects, summarizeBay, summarizeProject, timeAgo, todayAr,
  type CalNote, type CalTemplate,
} from "@/lib/calidad";
import { requireCalidad } from "@/lib/calidadServer";
import { numClass } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CalidadProjectPage({
  params, searchParams,
}: { params: { projectId: string }; searchParams: { bahia?: string } }) {
  if (!UUID.test(params.projectId)) notFound();
  const { supabase, role } = await requireCalidad();
  const [pd] = await loadProjects(supabase, [params.projectId]);
  if (!pd || !pd.project.active) notFound();

  const canEdit = CAN.editar(role);
  const today = todayAr();
  const summary = summarizeProject(pd);
  const selected = searchParams.bahia && UUID.test(searchParams.bahia) ? pd.bays.find((b) => b.id === searchParams.bahia) ?? null : null;

  const { data: tplRows } = await supabase.from("cal_templates").select("id, name, stages, active").order("created_at").order("name");
  const templates = (tplRows ?? []) as CalTemplate[];

  let notes: CalNote[] = [];
  if (selected) {
    const { data, error } = await supabase
      .from("cal_notes")
      .select("id, bay_id, group_id, note_date, body, created_by_name, created_at")
      .eq("bay_id", selected.id)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    notes = (data ?? []) as CalNote[];
  }

  const baySummary = selected ? summarizeBay(pd, selected) : null;
  const base = `/calidad/${pd.project.id}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={`Calidad · ${pd.project.code}`}
        title={pd.project.name}
        description={`Avance general ${summary.pct ?? "–"}${summary.pct !== null ? "%" : ""} · actualizado ${timeAgo(summary.lastUpdate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${base}/historial`} className={buttonClass({ variant: "secondary" })}>Historial</Link>
            <Link href={selected ? `${base}/imprimir?bahia=${selected.id}` : `${base}/imprimir`} className={buttonClass({ variant: "secondary" })}>
              Imprimir minuta
            </Link>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/calidad" className="text-sm text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">← Todos los proyectos</Link>
        {canEdit ? (
          <CalidadProjectBar project={pd.project} bay={selected} templates={templates} />
        ) : (
          <p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p>
        )}
      </div>

      <nav aria-label="Sectores" className="mt-5 flex gap-6 overflow-x-auto border-b border-slate-200">
        {[{ id: "", label: "Resumen", pct: summary.pct }, ...pd.bays.map((b) => ({ id: b.id, label: b.name, pct: summary.bays.find((s) => s.bay.id === b.id)?.pct ?? null }))].map((t) => {
          const active = (selected?.id ?? "") === t.id;
          return (
            <Link
              key={t.id || "resumen"}
              href={t.id ? `${base}?bahia=${t.id}` : base}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors duration-fast ease-out-expo ${
                active ? "border-ink font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {t.pct !== null && <span className={`ml-1.5 text-xs text-slate-500 ${numClass}`}>{t.pct}%</span>}
            </Link>
          );
        })}
      </nav>

      {!selected ? (
        pd.bays.length === 0 ? (
          <Card className="mt-5">
            <EmptyState
              icon={<IconClipboardCheck />}
              title="Este proyecto todavía no tiene sectores"
              description={canEdit ? "Sumá la primera bahía con «Nuevo sector»; adentro vas a cargar grupos y elementos." : "Cuando Calidad cargue los sectores van a aparecer acá."}
            />
          </Card>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {summary.bays.map((s) => (
              <li key={s.bay.id}>
                <Link
                  href={`${base}?bahia=${s.bay.id}`}
                  className="block rounded-xl border border-slate-200 bg-sheet p-5 transition-colors duration-base hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{s.bay.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.bay.responsible ? `${s.bay.responsible} · ` : ""}
                        {s.bay.due_date ? `compromiso ${fmtShortDate(s.bay.due_date)}` : "sin fecha compromiso"}
                      </p>
                    </div>
                    <span className={`text-xl font-medium text-slate-900 ${numClass}`}>{s.pct ?? "–"}{s.pct !== null && <span className="text-sm text-slate-500">%</span>}</span>
                  </div>
                  <CalidadProgress pct={s.pct} className="mt-3" label={`Avance de ${s.bay.name}`} />
                  {s.groups.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {s.groups.map((g) => (
                        <li key={g.data.group.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-slate-600">{g.data.group.name}</span>
                          <span className={`shrink-0 text-slate-900 ${numClass}`}>
                            {g.progress.totalQty > 0 ? `${g.progress.finalQty}/${g.progress.totalQty}` : "–"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Sin grupos cargados</p>
                  )}
                  <p className="mt-3 text-xs text-slate-500">Actualizado {timeAgo(s.lastUpdate)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span>Responsable: <span className="text-slate-900">{selected.responsible ?? "sin asignar"}</span></span>
            <span>Fecha compromiso: <span className={`text-slate-900 ${numClass}`}>{fmtShortDate(selected.due_date)}</span></span>
            {baySummary?.pct != null && <Badge tone={baySummary.pct >= 100 ? "success" : "neutral"} dot>{baySummary.pct}% de avance del sector</Badge>}
          </div>

          {baySummary && baySummary.groups.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconClipboardCheck />}
                title="Este sector todavía no tiene grupos"
                description={canEdit ? "Creá un grupo con «Nuevo grupo» (por ejemplo «Estructura lateral») y elegí sus etapas." : "Cuando Calidad cargue los grupos van a aparecer acá."}
              />
            </Card>
          ) : (
            baySummary?.groups.map((g) => (
              <CalidadGroupTable key={g.data.group.id} data={g.data} bayId={selected.id} canEdit={canEdit} today={today} templates={templates} />
            ))
          )}

          <CalidadNotes
            bayId={selected.id}
            notes={notes}
            groups={(baySummary?.groups ?? []).map((g) => ({ id: g.data.group.id, name: g.data.group.name }))}
            canEdit={canEdit}
            today={today}
          />
        </div>
      )}
    </div>
  );
}
