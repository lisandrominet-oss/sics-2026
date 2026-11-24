// Módulo Obras: el árbol del plan (WBS y actividades importadas de Primavera) y utilidades para mostrarlo.
// La base manda (RPC obra_* y can_manage_obras); esto solo arma lo que se ve.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ObraAccess = "editar" | "ver" | null;

export type ObraNode = {
  id: string;
  parent_id: string | null;
  kind: "wbs" | "actividad" | string;
  /** Código de Primavera (WBS completo o Activity ID); los agregados a mano empiezan con "manual-". */
  external_id: string;
  code: string;
  name: string;
  depth: number;
  position: number;
  active: boolean;
  baseline_start: string | null;
  baseline_end: string | null;
  current_start: string | null;
  current_end: string | null;
};

/** Columnas de project_nodes que usan las pantallas. */
export const OBRA_NODE_COLUMNS =
  "id, parent_id, kind, external_id, code, name, depth, position, active, baseline_start, baseline_end, current_start, current_end";

export type ObraTree = {
  byId: Map<string, ObraNode>;
  children: Map<string | null, ObraNode[]>;
  /** En orden de árbol (cada padre antes que sus hijos). */
  ordered: ObraNode[];
};

export function buildObraTree(nodes: ObraNode[]): ObraTree {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string | null, ObraNode[]>();
  for (const n of nodes) {
    const parent = n.parent_id && byId.has(n.parent_id) ? n.parent_id : null;
    const list = children.get(parent);
    if (list) list.push(n);
    else children.set(parent, [n]);
  }
  children.forEach((list) => list.sort((a, b) => a.position - b.position));
  const ordered: ObraNode[] = [];
  const walk = (parent: string | null) => {
    for (const n of children.get(parent) ?? []) {
      ordered.push(n);
      walk(n.id);
    }
  };
  walk(null);
  return { byId, children, ordered };
}

/** El nodo y todos los que cuelgan de él. */
export function descendantIds(tree: ObraTree, id: string): string[] {
  const out: string[] = [];
  const walk = (nid: string) => {
    out.push(nid);
    for (const c of tree.children.get(nid) ?? []) walk(c.id);
  };
  walk(id);
  return out;
}

/** Ancestros de un nodo, del más alto al padre directo. */
export function ancestors(tree: ObraTree, id: string): ObraNode[] {
  const out: ObraNode[] = [];
  let cur = tree.byId.get(id);
  while (cur?.parent_id) {
    const parent = tree.byId.get(cur.parent_id);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

export function nodeLabel(n: Pick<ObraNode, "code" | "name">) {
  return n.code && n.code !== n.name ? `${n.code} · ${n.name}` : n.name;
}

/** "B Direct cost › B1 Engineering" (la ruta hasta el padre del nodo). */
export function nodePathText(tree: ObraTree, id: string) {
  return ancestors(tree, id)
    .map((a) => a.code || a.name)
    .join(" › ");
}

export type DateRange = { start: string | null; end: string | null };

/**
 * Fechas vigentes y de línea base de cada nodo. Un nodo sin fechas propias (un WBS de Primavera)
 * muestra el rango de todo lo que cuelga de él.
 */
export function rollupDates(tree: ObraTree): Map<string, { current: DateRange; baseline: DateRange }> {
  const out = new Map<string, { current: DateRange; baseline: DateRange }>();
  const min = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
  const max = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
  const visit = (n: ObraNode): { current: DateRange; baseline: DateRange } => {
    let current: DateRange = { start: n.current_start, end: n.current_end };
    let baseline: DateRange = { start: n.baseline_start, end: n.baseline_end };
    const own = !!(n.current_start || n.current_end);
    for (const c of tree.children.get(n.id) ?? []) {
      const r = visit(c);
      if (!own && c.active) {
        current = { start: min(current.start, r.current.start), end: max(current.end, r.current.end) };
        baseline = { start: min(baseline.start, r.baseline.start), end: max(baseline.end, r.baseline.end) };
      }
    }
    const result = { current, baseline };
    out.set(n.id, result);
    return result;
  };
  for (const root of tree.children.get(null) ?? []) visit(root);
  return out;
}

/** Días entre dos fechas "AAAA-MM-DD" (b - a). */
export function daysBetween(a: string, b: string) {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Desvío del fin vigente contra el de la línea base: positivo = atraso. Null si falta alguna fecha. */
export function delayDays(r: { current: DateRange; baseline: DateRange } | undefined): number | null {
  if (!r) return null;
  const cur = r.current.end ?? r.current.start;
  const base = r.baseline.end ?? r.baseline.start;
  if (!cur || !base) return null;
  return daysBetween(base, cur);
}

export function formatShortDate(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function formatRange(r: DateRange) {
  if (!r.start && !r.end) return "Sin fechas";
  return `${formatShortDate(r.start)} → ${formatShortDate(r.end)}`;
}

export function delayText(days: number) {
  if (days === 0) return "En fecha";
  const n = Math.abs(days);
  return days > 0 ? `${n} ${n === 1 ? "día" : "días"} de atraso` : `${n} ${n === 1 ? "día" : "días"} adelantado`;
}

export const CHANGE_LABELS: Record<string, string> = {
  importacion: "Importación",
  plazo: "Cambio de plazo",
  corrimiento: "Corrimiento",
  nombre: "Cambio de nombre",
  alta: "Ítem agregado",
  baja: "Baja",
  reactivacion: "Reactivación",
  plan_borrado: "Plan borrado",
};

export type NodePath = { code: string; name: string; label: string; path: string };

/**
 * Etiqueta y ruta WBS de unos ítems de obra sin traer el plan entero: sube de padre en padre
 * (una consulta por nivel). Sirve en el servidor y en el navegador.
 */
export async function fetchNodePaths(supabase: SupabaseClient<Database>, nodeIds: string[]): Promise<Map<string, NodePath>> {
  const known = new Map<string, { id: string; parent_id: string | null; code: string; name: string }>();
  let pending = Array.from(new Set(nodeIds.filter(Boolean)));
  for (let level = 0; pending.length > 0 && level < 30; level++) {
    const { data } = await supabase.from("project_nodes").select("id, parent_id, code, name").in("id", pending);
    for (const n of data ?? []) known.set(n.id, n);
    pending = Array.from(new Set((data ?? []).map((n) => n.parent_id).filter((p): p is string => !!p && !known.has(p))));
  }
  const out = new Map<string, NodePath>();
  for (const id of nodeIds) {
    const n = known.get(id);
    if (!n) continue;
    const chain: string[] = [];
    let p = n.parent_id ? known.get(n.parent_id) : undefined;
    while (p) {
      chain.unshift(p.code || p.name);
      p = p.parent_id ? known.get(p.parent_id) : undefined;
    }
    out.set(id, { code: n.code, name: n.name, label: nodeLabel(n), path: chain.join(" › ") });
  }
  return out;
}
