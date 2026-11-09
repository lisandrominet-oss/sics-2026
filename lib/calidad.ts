import type { SupabaseClient } from "@supabase/supabase-js";

// Módulo "Calidad · Avance de obra". Los tipos de las tablas cal_* viven acá a mano hasta que se
// regenere lib/database.types.ts.
// Jerarquía: Proyecto → Sector (bahía, cocina…) → Grupo → Elemento. Cada grupo tiene sus etapas y
// cada elemento un total y, por etapa, una cantidad. La última etapa de un grupo es la «final» (En sitio).

export type CalRole = "admin" | "supervisor" | "consulta";

export type CalProject = { id: string; code: string; name: string; active: boolean };
export type CalBay = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  responsible: string | null;
  due_date: string | null;
  active: boolean;
};
export type CalGroup = {
  id: string;
  bay_id: string;
  name: string;
  position: number;
  active: boolean;
  progress_at: string | null;
  progress_by_name: string | null;
};
export type CalStage = { id: string; group_id: string; position: number; name: string };
export type CalItem = {
  id: string;
  group_id: string;
  name: string;
  position: number;
  total: number;
  due_date: string | null;
  completed_at: string | null;
  active: boolean;
};
export type CalCount = { item_id: string; stage_id: string; qty: number };
export type CalNote = {
  id: string;
  bay_id: string;
  group_id: string | null;
  note_date: string;
  body: string;
  created_by_name: string | null;
  created_at: string;
};
export type CalTemplate = { id: string; name: string; stages: string[]; active: boolean };
export type CalEvent = {
  id: string;
  entity: string;
  entity_id: string;
  event_type: string;
  actor_name: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

export const CAN = {
  editar: (r: CalRole | null) => r === "admin" || r === "supervisor",
  administrarSupervisores: (r: CalRole | null) => r === "admin",
};

export const ROLE_LABELS: Record<CalRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor de Calidad",
  consulta: "Solo lectura",
};

// Los tipos generados todavía no incluyen las tablas cal_*; se usa el cliente sin tipos de esquema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedClient = SupabaseClient<any, "public", any>;
export function untyped<T>(client: T): UntypedClient {
  return client as unknown as UntypedClient;
}

// ---------------------------------------------------------------- fechas (Argentina)
const TZ = "America/Argentina/Buenos_Aires";

/** Hoy en Argentina como AAAA-MM-DD (el servidor corre en UTC). */
export function todayAr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** 09/11/26 a partir de AAAA-MM-DD o de un ISO. */
export function fmtShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    timeZone: value.length === 10 ? undefined : TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** «hace 3 h», «ayer», «hace 4 días»; para fechas viejas, la fecha. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "sin cargas todavía";
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return fmtShortDate(iso);
}

// ---------------------------------------------------------------- cálculo de avance
export type GroupData = {
  group: CalGroup;
  stages: CalStage[];
  items: CalItem[];
  /** cantidad por `${item_id}:${stage_id}` (objeto simple: viaja del servidor al cliente) */
  counts: Record<string, number>;
};

export function countKey(itemId: string, stageId: string): string {
  return `${itemId}:${stageId}`;
}

export type GroupProgress = {
  /** unidades totales (suma de los totales de los elementos) */
  totalQty: number;
  /** unidades en la etapa final */
  finalQty: number;
  /** 0..100: etapa final / total; 0 si el grupo no tiene unidades */
  pct: number;
  /** suma por etapa (fila TOTAL de la planilla) */
  byStage: Map<string, number>;
  /** elementos completos / elementos con total > 0 */
  doneItems: number;
  countedItems: number;
};

export function groupProgress(g: GroupData): GroupProgress {
  const finalStage = g.stages.length ? g.stages[g.stages.length - 1] : null;
  const byStage = new Map<string, number>();
  let totalQty = 0;
  let finalQty = 0;
  let doneItems = 0;
  let countedItems = 0;
  for (const it of g.items) {
    totalQty += it.total;
    for (const st of g.stages) {
      byStage.set(st.id, (byStage.get(st.id) ?? 0) + (g.counts[countKey(it.id, st.id)] ?? 0));
    }
    if (finalStage) finalQty += g.counts[countKey(it.id, finalStage.id)] ?? 0;
    if (it.total > 0) {
      countedItems += 1;
      if (finalStage && (g.counts[countKey(it.id, finalStage.id)] ?? 0) >= it.total) doneItems += 1;
    }
  }
  const pct = totalQty > 0 ? Math.round((finalQty / totalQty) * 100) : 0;
  return { totalQty, finalQty, pct, byStage, doneItems, countedItems };
}

/** Promedio simple de los grupos con unidades (así 193 correas no tapan 2 columnas). */
export function averagePct(groups: GroupProgress[]): number | null {
  const withQty = groups.filter((g) => g.totalQty > 0);
  if (!withQty.length) return null;
  return Math.round(withQty.reduce((s, g) => s + g.pct, 0) / withQty.length);
}

// ---------------------------------------------------------------- carga de datos (servidor)
// PostgREST devuelve como mucho 1000 filas por consulta: se pagina para no cortar las cantidades.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

// Las listas de ids van en la URL: se parten en tandas para no pasarse del largo permitido.
export async function fetchIn<T>(
  ids: string[],
  build: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    out.push(...(await fetchAll<T>((f, t) => build(chunk, f, t))));
  }
  return out;
}

export type ProjectData = {
  project: CalProject;
  bays: CalBay[];
  /** grupos activos por sector, ya con etapas, elementos y cantidades */
  groupsByBay: Map<string, GroupData[]>;
};

const GROUP_COLS = "id, bay_id, name, position, active, progress_at, progress_by_name";
const ITEM_COLS = "id, group_id, name, position, total, due_date, completed_at, active";

/** Estructura completa de uno o varios proyectos (solo lo activo). */
export async function loadProjects(supabase: UntypedClient, projectIds: string[]): Promise<ProjectData[]> {
  if (!projectIds.length) return [];
  const [projects, bays] = await Promise.all([
    fetchAll<CalProject>((f, t) => supabase.from("cal_projects").select("id, code, name, active").in("id", projectIds).range(f, t)),
    fetchAll<CalBay>((f, t) =>
      supabase
        .from("cal_bays")
        .select("id, project_id, name, position, responsible, due_date, active")
        .in("project_id", projectIds)
        .eq("active", true)
        .order("position")
        .order("created_at")
        .range(f, t)
    ),
  ]);
  const bayIds = bays.map((b) => b.id);
  const groups = await fetchIn<CalGroup>(bayIds, (ids, f, t) =>
    supabase.from("cal_groups").select(GROUP_COLS).in("bay_id", ids).eq("active", true).order("position").order("created_at").range(f, t)
  );
  const groupIds = groups.map((g) => g.id);
  const [stages, items] = await Promise.all([
    fetchIn<CalStage>(groupIds, (ids, f, t) =>
      supabase.from("cal_stages").select("id, group_id, position, name").in("group_id", ids).order("position").order("id").range(f, t)
    ),
    fetchIn<CalItem>(groupIds, (ids, f, t) =>
      supabase.from("cal_items").select(ITEM_COLS).in("group_id", ids).eq("active", true).order("position").order("created_at").range(f, t)
    ),
  ]);
  const itemIds = items.map((i) => i.id);
  const counts = await fetchIn<CalCount>(itemIds, (ids, f, t) =>
    supabase.from("cal_counts").select("item_id, stage_id, qty").in("item_id", ids).order("item_id").order("stage_id").range(f, t)
  );

  const countsByItem = new Map<string, CalCount[]>();
  for (const c of counts) (countsByItem.get(c.item_id) ?? countsByItem.set(c.item_id, []).get(c.item_id)!).push(c);

  const stagesByGroup = new Map<string, CalStage[]>();
  for (const s of stages) (stagesByGroup.get(s.group_id) ?? stagesByGroup.set(s.group_id, []).get(s.group_id)!).push(s);
  const itemsByGroup = new Map<string, CalItem[]>();
  for (const i of items) (itemsByGroup.get(i.group_id) ?? itemsByGroup.set(i.group_id, []).get(i.group_id)!).push(i);

  return projects.map((project) => {
    const projBays = bays.filter((b) => b.project_id === project.id);
    const groupsByBay = new Map<string, GroupData[]>();
    for (const b of projBays) {
      groupsByBay.set(
        b.id,
        groups
          .filter((g) => g.bay_id === b.id)
          .map((group) => {
            const gItems = itemsByGroup.get(group.id) ?? [];
            const gCounts: Record<string, number> = {};
            for (const it of gItems) for (const c of countsByItem.get(it.id) ?? []) gCounts[countKey(c.item_id, c.stage_id)] = c.qty;
            return {
              group,
              stages: (stagesByGroup.get(group.id) ?? []).sort((a, z) => a.position - z.position),
              items: gItems,
              counts: gCounts,
            };
          })
      );
    }
    return { project, bays: projBays, groupsByBay };
  });
}

// ---------------------------------------------------------------- resúmenes
export type BaySummary = { bay: CalBay; groups: { data: GroupData; progress: GroupProgress }[]; pct: number | null; lastUpdate: string | null };

export function summarizeBay(pd: ProjectData, bay: CalBay): BaySummary {
  const groups = (pd.groupsByBay.get(bay.id) ?? []).map((data) => ({ data, progress: groupProgress(data) }));
  const times = groups.map((g) => g.data.group.progress_at).filter((t): t is string => !!t);
  return {
    bay,
    groups,
    pct: averagePct(groups.map((g) => g.progress)),
    lastUpdate: times.length ? times.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

export function summarizeProject(pd: ProjectData): { bays: BaySummary[]; pct: number | null; lastUpdate: string | null } {
  const bays = pd.bays.map((b) => summarizeBay(pd, b));
  const withPct = bays.filter((b) => b.pct !== null);
  const times = bays.map((b) => b.lastUpdate).filter((t): t is string => !!t);
  return {
    bays,
    pct: withPct.length ? Math.round(withPct.reduce((s, b) => s + (b.pct ?? 0), 0) / withPct.length) : null,
    lastUpdate: times.length ? times.reduce((a, b) => (a > b ? a : b)) : null,
  };
}
