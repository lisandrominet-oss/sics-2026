"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PromptDialog, { type PromptField } from "@/components/ui/PromptDialog";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import StatusBadge from "@/components/StatusBadge";
import ImportObraModal from "@/components/obras/ImportObraModal";
import ReimportObraModal from "@/components/obras/ReimportObraModal";
import { IconChevronDown, IconPlusCircle, IconSearch, IconUpload } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { formatDate, type SicStatus } from "@/lib/constants";
import { eyebrowClass, filterClass, numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";
import InfoTip from "@/components/ui/InfoTip";
import {
  CHANGE_LABELS,
  buildObraTree,
  delayDays,
  delayText,
  descendantIds,
  formatRange,
  formatShortDate,
  nodeLabel,
  nodePathText,
  rollupDates,
  type ObraNode,
} from "@/lib/obras";

export type ObraSic = {
  id: string;
  code: string;
  subject: string;
  status: SicStatus;
  needed_by_date: string | null;
  project_node_id: string | null;
};

export type ObraChange = {
  id: string;
  node_id: string | null;
  change_type: string;
  origin: string;
  old_start: string | null;
  old_end: string | null;
  new_start: string | null;
  new_end: string | null;
  detail: string | null;
  reason: string | null;
  created_at: string;
  actorName: string | null;
};

type Project = { id: string; name: string; code: string | null; active: boolean; source: string; imported_at: string | null };

type Dialog =
  | { kind: "plazo"; node: ObraNode }
  | { kind: "correr"; node: ObraNode }
  | { kind: "renombrar"; node: ObraNode }
  | { kind: "baja"; node: ObraNode }
  | { kind: "agregar"; parent: ObraNode | null }
  | { kind: "proyecto" }
  | null;

const ACTIVE_STATUSES_EXCLUDED: SicStatus[] = ["anulada", "rechazada_jefe", "rechazada_compras", "rechazada_gerencia"];
// SIC que todavía pueden llegar tarde a su ítem (las ya recibidas o terminadas no cuentan).
const LATE_CHECK_EXCLUDED: SicStatus[] = [...ACTIVE_STATUSES_EXCLUDED, "recibida", "cerrada"];

function changeText(c: ObraChange) {
  const dates =
    c.old_start || c.new_start || c.old_end || c.new_end
      ? `${formatRange({ start: c.old_start, end: c.old_end })} ⇒ ${formatRange({ start: c.new_start, end: c.new_end })}`
      : null;
  return [c.detail, dates].filter(Boolean).join(" · ");
}

export default function ObraDetail({
  project,
  nodes,
  sics,
  changes,
  canEdit,
  canCreateSic,
}: {
  project: Project;
  nodes: ObraNode[];
  sics: ObraSic[];
  changes: ObraChange[];
  canEdit: boolean;
  canCreateSic: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.depth === 0).map((n) => n.id)));
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reimportOpen, setReimportOpen] = useState(false);

  const tree = useMemo(() => buildObraTree(nodes), [nodes]);
  const dates = useMemo(() => rollupDates(tree), [tree]);

  // SIC por ítem, contando también las de todo lo que cuelga de él (las anuladas y rechazadas no suman).
  const sicCount = useMemo(() => {
    const direct = new Map<string, number>();
    for (const s of sics) {
      if (!s.project_node_id || ACTIVE_STATUSES_EXCLUDED.includes(s.status)) continue;
      direct.set(s.project_node_id, (direct.get(s.project_node_id) ?? 0) + 1);
    }
    const total = new Map<string, number>();
    const visit = (n: ObraNode): number => {
      let sum = direct.get(n.id) ?? 0;
      for (const c of tree.children.get(n.id) ?? []) sum += visit(c);
      total.set(n.id, sum);
      return sum;
    };
    for (const r of tree.children.get(null) ?? []) visit(r);
    return total;
  }, [sics, tree]);
  // Aviso solo en pantalla: SIC abiertas que se necesitan después de que arranque su ítem (por ejemplo, porque la obra
  // se adelantó). No toca la campana ni el circuito.
  const lateSics = useMemo(
    () =>
      sics
        .filter((s) => s.project_node_id && s.needed_by_date && !LATE_CHECK_EXCLUDED.includes(s.status))
        .map((s) => ({ sic: s, start: dates.get(s.project_node_id!)?.current.start ?? null }))
        .filter((x) => x.start && x.sic.needed_by_date! > x.start),
    [sics, dates]
  );
  const generalCount = sics.filter((s) => !s.project_node_id && !ACTIVE_STATUSES_EXCLUDED.includes(s.status)).length;

  // Con búsqueda: lo que coincide y sus ancestros, todo abierto. Sin búsqueda: según lo expandido.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const keep = new Set<string>();
      for (const n of tree.ordered) {
        if (!showInactive && !n.active) continue;
        if (n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)) {
          keep.add(n.id);
          let p = n.parent_id;
          while (p && !keep.has(p)) {
            keep.add(p);
            p = tree.byId.get(p)?.parent_id ?? null;
          }
        }
      }
      return tree.ordered.filter((n) => keep.has(n.id));
    }
    const out: ObraNode[] = [];
    const walk = (parent: string | null) => {
      for (const n of tree.children.get(parent) ?? []) {
        if (!showInactive && !n.active) continue;
        out.push(n);
        if (expanded.has(n.id)) walk(n.id);
      }
    };
    walk(null);
    return out;
  }, [tree, expanded, query, showInactive]);

  const openNode = openNodeId ? tree.byId.get(openNodeId) ?? null : null;
  const openNodeSics = useMemo(() => {
    if (!openNode) return [];
    const ids = new Set(descendantIds(tree, openNode.id));
    return sics.filter((s) => s.project_node_id && ids.has(s.project_node_id));
  }, [openNode, sics, tree]);
  const openNodeChanges = openNode ? changes.filter((c) => c.node_id === openNode.id) : [];

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(promise: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await promise;
    if (error) {
      notify.error("No se pudo guardar", error.message);
      return false;
    }
    notify.success(ok);
    router.refresh();
    return true;
  }

  async function deletePlan() {
    const ok = await confirm({
      title: "¿Borrar el plan de la obra?",
      description: "Se borran todos los ítems y su historial de plazos. Solo se puede si ninguna SIC está clasificada en la obra. El proyecto queda.",
      confirmLabel: "Borrar el plan",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    await run(supabase.rpc("obra_plan_delete", { p_project_id: project.id }), "Plan borrado");
  }

  const supabase = createClient();
  const dialogFields: Record<string, PromptField[]> = {
    plazo:
      dialog?.kind === "plazo"
        ? [
            { name: "start", label: "Inicio", type: "date", required: true, defaultValue: dialog.node.current_start ?? "" },
            {
              name: "end",
              label: "Fin",
              type: "date",
              required: true,
              defaultValue: dialog.node.current_end ?? "",
            },
            { name: "reason", label: "Motivo", required: true, placeholder: "Ej: atraso en la entrega de ingeniería" },
          ]
        : [],
    correr: [
      {
        name: "days",
        label: "Días",
        required: true,
        inputMode: "numeric",
        hint: "Positivo atrasa, negativo adelanta (ej: 7 o -3).",
        validate: (v) => (/^-?\d+$/.test(v) && Number(v) !== 0 ? null : "Escribí un número entero distinto de cero."),
      },
      { name: "reason", label: "Motivo", required: true, placeholder: "Ej: lluvias" },
    ],
    renombrar:
      dialog?.kind === "renombrar"
        ? [
            { name: "code", label: "Código", required: true, defaultValue: dialog.node.code },
            { name: "name", label: "Nombre", required: true, defaultValue: dialog.node.name },
          ]
        : [],
    baja: [{ name: "reason", label: "Motivo", required: true }],
    agregar: [
      { name: "code", label: "Código", required: true, placeholder: "Ej: B2.9" },
      { name: "name", label: "Nombre", required: true },
      { name: "start", label: "Inicio (opcional)", type: "date" },
      { name: "end", label: "Fin (opcional)", type: "date" },
    ],
    proyecto: [
      { name: "name", label: "Nombre", required: true, defaultValue: project.name },
      { name: "code", label: "Código", defaultValue: project.code ?? "" },
    ],
  };

  async function submitDialog(v: Record<string, string>) {
    if (!dialog) return true;
    switch (dialog.kind) {
      case "plazo":
        if (v.end < v.start) {
          notify.error("Revisá las fechas", "El fin no puede ser anterior al inicio.");
          return false;
        }
        return run(
          supabase.rpc("obra_node_reschedule", { p_node_id: dialog.node.id, p_start: v.start, p_end: v.end, p_reason: v.reason }),
          "Plazo actualizado"
        );
      case "correr":
        return run(
          supabase.rpc("obra_node_shift", { p_node_id: dialog.node.id, p_days: Number(v.days), p_reason: v.reason }),
          Number(v.days) > 0 ? `Se atrasó ${v.days} días` : `Se adelantó ${-Number(v.days)} días`
        );
      case "renombrar":
        return run(supabase.rpc("obra_node_rename", { p_node_id: dialog.node.id, p_code: v.code, p_name: v.name }), "Ítem actualizado");
      case "baja":
        return run(
          supabase.rpc("obra_node_set_active", { p_node_id: dialog.node.id, p_active: !dialog.node.active, p_reason: v.reason }),
          dialog.node.active ? "Ítem dado de baja" : "Ítem reactivado"
        );
      case "agregar":
        if (v.start && v.end && v.end < v.start) {
          notify.error("Revisá las fechas", "El fin no puede ser anterior al inicio.");
          return false;
        }
        return run(
          supabase.rpc("obra_node_create", {
            p_project_id: project.id,
            p_parent_id: dialog.parent?.id ?? null,
            p_kind: dialog.parent ? "actividad" : "wbs",
            p_code: v.code,
            p_name: v.name,
            p_start: v.start || null,
            p_end: v.end || null,
          }),
          "Ítem agregado"
        );
      case "proyecto":
        return run(supabase.rpc("obra_project_update", { p_project_id: project.id, p_name: v.name, p_code: v.code || null }), "Datos guardados");
    }
  }

  const dialogTitle =
    dialog?.kind === "plazo"
      ? `Cambiar plazos de ${dialog.node.code}`
      : dialog?.kind === "correr"
        ? `Correr ${dialog.node.code} y lo que cuelga`
        : dialog?.kind === "renombrar"
          ? "Renombrar ítem"
          : dialog?.kind === "baja"
            ? dialog.node.active
              ? `Dar de baja ${dialog.node.code}`
              : `Reactivar ${dialog.node.code}`
            : dialog?.kind === "agregar"
              ? dialog.parent
                ? `Agregar dentro de ${dialog.parent.code}`
                : "Agregar ítem de primer nivel"
              : dialog?.kind === "proyecto"
                ? "Datos de la obra"
                : "";

  const dialogDescription =
    dialog?.kind === "plazo"
      ? "La línea base no cambia: queda para comparar contra lo planificado."
      : dialog?.kind === "baja" && dialog.node.active
          ? "No se ofrece más al cargar una SIC (tampoco lo que cuelga de él). Las SIC que ya lo tienen lo conservan."
          : undefined;

  const hasPlan = nodes.length > 0;
  const recent = changes.slice(0, 20);

  return (
    <>
      <PageHeader
        className="mt-4"
        eyebrow={<span className={numClass}>{[project.code, "Obra"].filter(Boolean).join(" · ")}</span>}
        title={project.name}
        description={
          hasPlan
            ? `${nodes.filter((n) => n.active).length} ítems${project.imported_at ? ` · importada de Primavera el ${formatDate(project.imported_at)}` : ""} · ${sics.length} SIC`
            : undefined
        }
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDialog({ kind: "proyecto" })}>
                Editar datos
              </Button>
              {hasPlan ? (
                <Button onClick={() => setReimportOpen(true)}>
                  <IconUpload className="h-4 w-4" />
                  Actualizar desde Primavera
                </Button>
              ) : (
                <Button onClick={() => setImportOpen(true)}>
                  <IconUpload className="h-4 w-4" />
                  Importar desde Primavera
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {!hasPlan ? (
        <EmptyState
          className="mt-6"
          title="Sin plan de obra"
        />
      ) : (
        <>
          {lateSics.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">
                {lateSics.length === 1 ? "1 SIC se necesita" : `${lateSics.length} SIC se necesitan`} después de que arranca su ítem
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                {lateSics.slice(0, 10).map(({ sic, start }) => (
                  <li key={sic.id}>
                    <Link href={`/sic/${sic.id}`} className={cn("font-semibold underline", numClass)}>
                      {sic.code}
                    </Link>{" "}
                    · necesaria el {formatShortDate(sic.needed_by_date)} · el ítem {tree.byId.get(sic.project_node_id!)?.code} arranca el{" "}
                    {formatShortDate(start)}
                  </li>
                ))}
              </ul>
              {lateSics.length > 10 && <p className="mt-1 text-xs text-amber-800">Y {lateSics.length - 10} más.</p>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="relative w-full sm:w-80">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por código o nombre"
                aria-label="Buscar ítem de la obra"
                className={cn(filterClass, "w-full pl-9")}
              />
            </div>
            <Button variant="link" size="sm" onClick={() => setExpanded(new Set(nodes.map((n) => n.id)))}>
              Abrir todo
            </Button>
            <Button variant="link" size="sm" onClick={() => setExpanded(new Set())}>
              Cerrar todo
            </Button>
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600 sm:min-h-0">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-slate-900" />
              Ver dados de baja
            </label>
            {canEdit && (
              <Button variant="link" size="sm" className="sm:ml-auto" onClick={() => setDialog({ kind: "agregar", parent: null })}>
                Agregar ítem
              </Button>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[minmax(0,1fr)_11rem_8rem_4rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:grid">
              <span>Ítem</span>
              <span>Plazo vigente</span>
              <span>Contra línea base</span>
              <span className="text-right">SIC</span>
            </div>
            {generalCount > 0 && !query && (
              <div className="border-b border-slate-200 px-3 py-2 text-sm text-slate-600">
                General del proyecto (sin ítem): <span className={numClass}>{generalCount}</span> SIC
              </div>
            )}
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Ningún ítem coincide con la búsqueda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((n) => {
                  const hasChildren = (tree.children.get(n.id) ?? []).some((c) => showInactive || c.active);
                  const isOpen = query ? true : expanded.has(n.id);
                  const r = dates.get(n.id);
                  const delay = delayDays(r);
                  const count = sicCount.get(n.id) ?? 0;
                  return (
                    <li key={n.id} className={cn("flex items-stretch", !n.active && "opacity-60")}>
                      <span className="shrink-0" style={{ width: `${Math.min(n.depth, 10) * 1.25}rem` }} aria-hidden="true" />
                      {hasChildren && !query ? (
                        <button
                          type="button"
                          onClick={() => toggle(n.id)}
                          aria-label={isOpen ? `Cerrar ${n.code}` : `Abrir ${n.code}`}
                          aria-expanded={isOpen}
                          className="flex w-10 shrink-0 items-center justify-center text-slate-500 hover:text-slate-900"
                        >
                          <IconChevronDown className={cn("h-4 w-4 transition-transform duration-fast", !isOpen && "-rotate-90")} />
                        </button>
                      ) : (
                        <span className="w-10 shrink-0" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenNodeId(n.id)}
                        className="grid min-h-11 min-w-0 flex-1 grid-cols-1 items-center gap-x-3 py-2 pr-3 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_11rem_8rem_4rem]"
                      >
                        <span className="min-w-0">
                          <span className={cn("mr-2 text-xs text-slate-500", numClass)}>{n.code}</span>
                          <span className={cn("text-sm [overflow-wrap:anywhere]", n.kind === "wbs" ? "font-medium text-slate-900" : "text-slate-700")}>
                            {n.name}
                          </span>
                          {!n.active && (
                            <Badge tone="muted" size="sm" className="ml-2">
                              De baja
                            </Badge>
                          )}
                        </span>
                        {/* En celular, plazo, desvío y SIC van en una línea; desde md son columnas (el contenedor desaparece). */}
                        <span className="mt-0.5 flex flex-wrap gap-x-3 md:contents">
                          <span className={cn("text-xs text-slate-600", numClass)}>{r ? formatRange(r.current) : "-"}</span>
                          <span className={cn("text-xs", numClass, delay && delay > 0 ? "text-red-700" : delay && delay < 0 ? "text-emerald-700" : "text-slate-500")}>
                            {delay === null ? "" : delayText(delay)}
                          </span>
                          <span className={cn("text-xs md:text-right", numClass, count ? "text-slate-900" : "text-slate-400 max-md:hidden")}>
                            {count ? `${count} SIC` : "-"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <section className="mt-8">
            <h2 className="text-base font-semibold text-slate-900">Historial</h2>
            {recent.length === 0 ? (
              <EmptyState size="sm" className="mt-2" title="Sin cambios registrados." />
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {recent.map((c) => {
                  const node = c.node_id ? tree.byId.get(c.node_id) : null;
                  return (
                    <li key={c.id} className="text-slate-700">
                      <span className={cn("text-xs text-slate-500", numClass)}>{formatDate(c.created_at)}</span>{" "}
                      <span className="font-medium text-slate-900">{CHANGE_LABELS[c.change_type] ?? c.change_type}</span>
                      {node && <span> · {node.code}</span>}
                      {changeText(c) && <span className="text-slate-600"> · {changeText(c)}</span>}
                      {c.reason && <span className="text-slate-600"> · Motivo: {c.reason}</span>}
                      {c.actorName && <span className="text-slate-500"> · {c.actorName}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit && (
              <Button variant="link-danger" size="sm" className="mt-6" onClick={deletePlan}>
                Borrar el plan de la obra
              </Button>
            )}
          </section>
        </>
      )}

      <Modal open={!!openNode} onClose={() => setOpenNodeId(null)} title={openNode ? nodeLabel(openNode) : "Ítem"} className="sm:max-w-xl">
        {openNode && (
          <div className="mt-2 space-y-4 text-sm">
            {nodePathText(tree, openNode.id) && <p className={eyebrowClass}>{nodePathText(tree, openNode.id)}</p>}
            {!openNode.active && (
              <Badge tone="muted" size="sm">
                De baja
              </Badge>
            )}
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="flex items-center gap-1.5 text-slate-500">
                Plazo vigente
                {!openNode.current_start && !openNode.current_end && (dates.get(openNode.id)?.current.start || dates.get(openNode.id)?.current.end) && (
                  <InfoTip>Las fechas son el rango de lo que cuelga de este ítem.</InfoTip>
                )}
              </dt>
              <dd className={numClass}>{formatRange(dates.get(openNode.id)?.current ?? { start: null, end: null })}</dd>
              <dt className="text-slate-500">Línea base</dt>
              <dd className={numClass}>{formatRange(dates.get(openNode.id)?.baseline ?? { start: null, end: null })}</dd>
              <dt className="text-slate-500">Desvío</dt>
              <dd>{delayDays(dates.get(openNode.id)) === null ? "-" : delayText(delayDays(dates.get(openNode.id))!)}</dd>
            </dl>

            <div className="flex flex-wrap gap-2">
              {canCreateSic && openNode.active && (
                <Link href={`/sic/nueva?proyecto=${project.id}&item=${openNode.id}`} className={buttonClass()}>
                  <IconPlusCircle className="h-4 w-4" />
                  Nueva SIC para este ítem
                </Link>
              )}
              {canEdit && (
                <>
                  <Button variant="secondary" onClick={() => setDialog({ kind: "plazo", node: openNode })}>
                    Cambiar plazos
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog({ kind: "correr", node: openNode })}>
                    Correr días
                  </Button>
                </>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <Button variant="link" size="sm" onClick={() => setDialog({ kind: "renombrar", node: openNode })}>
                  Renombrar
                </Button>
                <Button variant="link" size="sm" onClick={() => setDialog({ kind: "agregar", parent: openNode })}>
                  Agregar ítem adentro
                </Button>
                <Button variant={openNode.active ? "link-danger" : "link"} size="sm" onClick={() => setDialog({ kind: "baja", node: openNode })}>
                  {openNode.active ? "Dar de baja" : "Reactivar"}
                </Button>
              </div>
            )}

            <div>
              <h3 className="font-medium text-slate-900">SIC de este ítem</h3>
              {openNodeSics.length === 0 ? (
                <p className="mt-1 text-slate-500">Todavía no hay SIC clasificadas acá (o no las podés ver).</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {openNodeSics.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sic/${s.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-slate-50">
                        <span className={cn("text-xs font-medium text-slate-900", numClass)}>{s.code}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{s.subject}</span>
                        {s.needed_by_date && <span className={cn("text-xs text-slate-500", numClass)}>{formatShortDate(s.needed_by_date)}</span>}
                        <StatusBadge status={s.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {openNodeChanges.length > 0 && (
              <div>
                <h3 className="font-medium text-slate-900">Historial del ítem</h3>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {openNodeChanges.map((c) => (
                    <li key={c.id}>
                      <span className={numClass}>{formatDate(c.created_at)}</span> · {CHANGE_LABELS[c.change_type] ?? c.change_type}
                      {changeText(c) && ` · ${changeText(c)}`}
                      {c.reason && ` · Motivo: ${c.reason}`}
                      {c.actorName && ` · ${c.actorName}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <PromptDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialogTitle}
        description={dialogDescription}
        fields={dialog ? dialogFields[dialog.kind] : []}
        confirmLabel={dialog?.kind === "baja" ? (dialog.node.active ? "Dar de baja" : "Reactivar") : "Guardar"}
        destructive={dialog?.kind === "baja" && dialog.node.active}
        onSubmit={submitDialog}
      />

      <ReimportObraModal open={reimportOpen} onClose={() => setReimportOpen(false)} projectId={project.id} currentNodes={nodes} />
      <ImportObraModal open={importOpen} onClose={() => setImportOpen(false)} projectsWithoutPlan={[]} fixedProjectId={project.id} />
    </>
  );
}
