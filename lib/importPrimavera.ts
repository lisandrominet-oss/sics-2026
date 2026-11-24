// Lectura del plan de una obra exportado desde Primavera P6, para el módulo Obras.
// Acepta el .xer (exportación nativa, texto separado por tabulaciones) y el export de actividades
// a Excel guardado como CSV (o pegado desde la planilla). Solo se lee texto: no se usa `XLSX.read`.
// Arma la lista de nodos (WBS y actividades) que recibe la RPC `obra_import`, con cada padre antes que sus hijos.

import { parseCsv, parsePastedTable } from "@/lib/csv";

export type ObraNodeKind = "wbs" | "actividad";

export type ObraNodeDraft = {
  ref: string;
  parent_ref: string | null;
  kind: ObraNodeKind;
  /** Identificador estable en Primavera: código WBS completo o Activity ID. Sirve para actualizar después. */
  external_id: string;
  /** Lo que se muestra (ej. "B2.1" o "A1040"). */
  code: string;
  name: string;
  current_start: string | null;
  current_end: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  depth: number;
};

export type PrimaveraProject = {
  key: string;
  name: string;
  code: string | null;
  nodes: ObraNodeDraft[];
};

export type PrimaveraResult =
  | { ok: true; format: "xer" | "csv"; projects: PrimaveraProject[]; warnings: string[] }
  | { ok: false; error: string };

export const MAX_OBRA_NODES = 10000;

// ---------------------------------------------------------------------------------------------------------
// Fechas

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7, aug: 8, ago: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Fecha de Primavera o de una planilla a "AAAA-MM-DD". Entiende "2027-01-15 08:00" (xer), "15/01/2027",
 * "15-Jan-27", "15-ene-2027", el número de serie de Excel y las marcas de P6 ("15-Jan-27 A" real, "*" restricción).
 * Día primero, como se escribe en Argentina. Devuelve null si no la reconoce.
 */
export function parsePrimaveraDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/\s*[A*]+$/, "").trim();
  if (!v) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) return iso(+m[3], +m[2], +m[1]);

  m = /^(\d{1,2})[\s/.-]([A-Za-z]{3})[a-z]*\.?[\s/.-](\d{2,4})/.exec(v);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    return month ? iso(+m[3], month, +m[1]) : null;
  }

  // Número de serie de Excel (días desde 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const serial = Math.floor(Number(v));
    if (serial > 30000 && serial < 75000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

function orderDates(start: string | null, end: string | null): [string | null, string | null] {
  if (start && end && end < start) return [start, start];
  return [start, end];
}

// ---------------------------------------------------------------------------------------------------------
// XER

type XerTable = { fields: string[]; rows: Record<string, string>[] };

function parseXerTables(text: string): Map<string, XerTable> {
  const tables = new Map<string, XerTable>();
  let current: XerTable | null = null;
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (line.startsWith("%T\t")) {
      current = { fields: [], rows: [] };
      tables.set(line.slice(3).trim(), current);
    } else if (line.startsWith("%F\t") && current) {
      current.fields = line.slice(3).split("\t");
    } else if (line.startsWith("%R\t") && current) {
      const values = line.slice(3).split("\t");
      const row: Record<string, string> = {};
      current.fields.forEach((f, i) => (row[f] = values[i] ?? ""));
      current.rows.push(row);
    }
  }
  return tables;
}

function firstDate(row: Record<string, string>, fields: string[]): string | null {
  for (const f of fields) {
    const d = parsePrimaveraDate(row[f]);
    if (d) return d;
  }
  return null;
}

function parseXer(text: string): PrimaveraResult {
  const tables = parseXerTables(text);
  const wbsTable = tables.get("PROJWBS");
  const taskTable = tables.get("TASK");
  if (!wbsTable || !taskTable) {
    return { ok: false, error: "El archivo .xer no trae la WBS (PROJWBS) o las actividades (TASK). Exportá el proyecto completo desde Primavera." };
  }
  const projectTable = tables.get("PROJECT");
  const warnings: string[] = [];
  const projects: PrimaveraProject[] = [];

  const projIds = Array.from(new Set(wbsTable.rows.map((r) => r.proj_id)));
  for (const projId of projIds) {
    const wbsRows = wbsTable.rows.filter((r) => r.proj_id === projId);
    const tasks = taskTable.rows.filter((r) => r.proj_id === projId);
    const root = wbsRows.find((r) => r.proj_node_flag === "Y");
    const projRow = projectTable?.rows.find((r) => r.proj_id === projId);
    const code = projRow?.proj_short_name?.trim() || root?.wbs_short_name?.trim() || null;
    const name = root?.wbs_name?.trim() || code || `Proyecto ${projId}`;

    const byId = new Map(wbsRows.map((r) => [r.wbs_id, r]));
    const children = new Map<string, Record<string, string>[]>();
    for (const r of wbsRows) {
      if (r === root) continue;
      // Un WBS cuyo padre es la raíz del proyecto (o que no tiene padre conocido) queda en el primer nivel.
      const parent = r.parent_wbs_id && byId.has(r.parent_wbs_id) && byId.get(r.parent_wbs_id) !== root ? r.parent_wbs_id : "";
      children.set(parent, [...(children.get(parent) ?? []), r]);
    }
    const tasksByWbs = new Map<string, Record<string, string>[]>();
    for (const t of tasks) {
      const w = t.wbs_id && byId.has(t.wbs_id) && byId.get(t.wbs_id) !== root ? t.wbs_id : "";
      tasksByWbs.set(w, [...(tasksByWbs.get(w) ?? []), t]);
    }

    const nodes: ObraNodeDraft[] = [];
    // Primavera no permite códigos repetidos, pero un export editado a mano podría traerlos: se avisa y no se rompe.
    const seenTasks = new Set<string>();
    const seenWbs = new Set<string>();
    const seqSort = (a: Record<string, string>, b: Record<string, string>) =>
      (Number(a.seq_num) || 0) - (Number(b.seq_num) || 0) || (a.wbs_short_name ?? "").localeCompare(b.wbs_short_name ?? "");

    const pushTasks = (wbsId: string, parentRef: string | null, depth: number) => {
      const list = (tasksByWbs.get(wbsId) ?? []).map((t) => {
        const cs = firstDate(t, ["act_start_date", "restart_date", "early_start_date", "target_start_date"]);
        const ce = firstDate(t, ["act_end_date", "reend_date", "early_end_date", "target_end_date"]);
        const bs = firstDate(t, ["target_start_date"]);
        const be = firstDate(t, ["target_end_date"]);
        return { t, cs, ce, bs, be };
      });
      list.sort((a, b) => (a.cs ?? "9999").localeCompare(b.cs ?? "9999") || (a.t.task_code ?? "").localeCompare(b.t.task_code ?? ""));
      for (const { t, cs, ce, bs, be } of list) {
        const code = t.task_code?.trim() || t.task_id;
        if (seenTasks.has(code)) {
          warnings.push(`La actividad ${code} está repetida; se tomó la primera.`);
          continue;
        }
        seenTasks.add(code);
        const [cStart, cEnd] = orderDates(cs, ce);
        const [bStart, bEnd] = orderDates(bs, be);
        nodes.push({
          ref: `t:${t.task_id}`,
          parent_ref: parentRef,
          kind: "actividad",
          external_id: code,
          code,
          name: t.task_name?.trim() || code,
          current_start: cStart,
          current_end: cEnd,
          baseline_start: bStart,
          baseline_end: bEnd,
          depth,
        });
      }
    };

    const walk = (parentId: string, parentRef: string | null, path: string, depth: number) => {
      for (const w of (children.get(parentId) ?? []).sort(seqSort)) {
        const short = w.wbs_short_name?.trim() || w.wbs_id;
        let fullCode = path ? `${path}.${short}` : short;
        if (seenWbs.has(fullCode)) {
          warnings.push(`El WBS ${fullCode} está repetido en el mismo nivel; se distingue por su número interno.`);
          fullCode = `${fullCode}~${w.wbs_id}`;
        }
        seenWbs.add(fullCode);
        const ref = `w:${w.wbs_id}`;
        nodes.push({
          ref,
          parent_ref: parentRef,
          kind: "wbs",
          external_id: fullCode,
          code: short,
          name: w.wbs_name?.trim() || short,
          current_start: null,
          current_end: null,
          baseline_start: null,
          baseline_end: null,
          depth,
        });
        walk(w.wbs_id, ref, fullCode, depth + 1);
        pushTasks(w.wbs_id, ref, depth + 1);
      }
    };
    walk("", null, "", 0);
    pushTasks("", null, 0);

    if (nodes.length > 0) projects.push({ key: projId, name, code, nodes });
  }

  if (projects.length === 0) return { ok: false, error: "El archivo .xer no tiene actividades ni WBS." };
  if (projects.length > 1) {
    warnings.push(`El archivo trae ${projects.length} proyectos (puede incluir líneas base). Elegí cuál importar.`);
  }
  return { ok: true, format: "xer", projects, warnings };
}

// ---------------------------------------------------------------------------------------------------------
// CSV / planilla (export de actividades de P6 a Excel)

type CsvField = "wbsCode" | "wbsName" | "activityId" | "activityName" | "start" | "finish" | "blStart" | "blFinish";

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(\*\)|\*/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CSV_HEADERS: Record<string, CsvField> = {
  "wbs code": "wbsCode",
  wbs: "wbsCode",
  "codigo wbs": "wbsCode",
  "codigo de wbs": "wbsCode",
  "wbs name": "wbsName",
  "nombre wbs": "wbsName",
  "nombre de wbs": "wbsName",
  "activity id": "activityId",
  "id de actividad": "activityId",
  "id actividad": "activityId",
  "actividad id": "activityId",
  "activity name": "activityName",
  "nombre de actividad": "activityName",
  "nombre de la actividad": "activityName",
  "nombre actividad": "activityName",
  start: "start",
  inicio: "start",
  "fecha de inicio": "start",
  "planned start": "blStart",
  "inicio planificado": "blStart",
  finish: "finish",
  fin: "finish",
  "fecha de fin": "finish",
  "fecha fin": "finish",
  "planned finish": "blFinish",
  "fin planificado": "blFinish",
  "bl project start": "blStart",
  "bl start": "blStart",
  "bl1 start": "blStart",
  "baseline start": "blStart",
  "inicio linea base": "blStart",
  "inicio de linea base": "blStart",
  "bl project finish": "blFinish",
  "bl finish": "blFinish",
  "bl1 finish": "blFinish",
  "baseline finish": "blFinish",
  "fin linea base": "blFinish",
  "fin de linea base": "blFinish",
};

export const OBRA_CSV_TEMPLATE_HEADERS = ["WBS Code", "WBS Name", "Activity ID", "Activity Name", "Start", "Finish", "BL Project Start", "BL Project Finish"];

function parseCsvPlan(rows: string[][], fileName: string): PrimaveraResult {
  const headerIndex = rows.findIndex((r) => r.filter((c) => CSV_HEADERS[normalizeHeader(c)]).length >= 2);
  if (headerIndex < 0) {
    return {
      ok: false,
      error: `No se reconocen las columnas. Hacen falta al menos "WBS Code" y "Activity ID" o "Activity Name" (con "Start" y "Finish"). Columnas esperadas: ${OBRA_CSV_TEMPLATE_HEADERS.join(", ")}.`,
    };
  }
  const header = rows[headerIndex];
  const col: Partial<Record<CsvField, number>> = {};
  header.forEach((h, i) => {
    const f = CSV_HEADERS[normalizeHeader(h)];
    if (f && col[f] === undefined) col[f] = i;
  });
  if (col.wbsCode === undefined && col.activityId === undefined) {
    return { ok: false, error: 'Falta la columna "WBS Code" o "Activity ID".' };
  }

  const get = (r: string[], f: CsvField) => (col[f] === undefined ? "" : (r[col[f]!] ?? "").trim());
  const warnings: string[] = [];
  const wbsNames = new Map<string, string>();
  const wbsOrder: string[] = [];
  const activities: { row: number; wbs: string; id: string; name: string; cs: string | null; ce: string | null; bs: string | null; be: string | null }[] = [];
  const seenActivity = new Set<string>();
  let badDates = 0;

  const ensureWbs = (code: string) => {
    const parts = code.split(".").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      const c = parts.slice(0, i).join(".");
      if (!wbsNames.has(c)) {
        wbsNames.set(c, "");
        wbsOrder.push(c);
      }
    }
  };

  rows.slice(headerIndex + 1).forEach((r, i) => {
    const wbs = get(r, "wbsCode").replace(/\s+/g, "");
    const id = get(r, "activityId");
    const name = get(r, "activityName");
    if (wbs) ensureWbs(wbs);
    if (!id && !name) {
      // Fila de WBS (banda de agrupamiento en el export): solo aporta el nombre.
      const wbsName = get(r, "wbsName");
      if (wbs && wbsName) wbsNames.set(wbs, wbsName);
      return;
    }
    if (wbs && get(r, "wbsName") && !wbsNames.get(wbs)) wbsNames.set(wbs, get(r, "wbsName"));
    const actId = id || `${wbs}:${name}`;
    if (seenActivity.has(actId)) {
      warnings.push(`Fila ${headerIndex + i + 2}: la actividad ${actId} está repetida; se tomó la primera.`);
      return;
    }
    seenActivity.add(actId);
    const rawDates = [get(r, "start"), get(r, "finish"), get(r, "blStart"), get(r, "blFinish")];
    const [cs, ce, bs, be] = rawDates.map(parsePrimaveraDate);
    rawDates.forEach((raw, k) => {
      if (raw && ![cs, ce, bs, be][k]) badDates += 1;
    });
    activities.push({ row: headerIndex + i + 2, wbs, id: actId, name: name || actId, cs, ce, bs, be });
  });

  if (badDates > 0) warnings.push(`${badDates} fecha(s) no se pudieron leer y quedaron vacías.`);
  if (activities.length === 0 && wbsOrder.length === 0) return { ok: false, error: "La planilla no tiene filas con datos." };

  // Si todas las WBS comparten el mismo primer segmento (el código del proyecto), ese nivel no se repite como ítem.
  const firstSegments = new Set(wbsOrder.map((c) => c.split(".")[0]));
  const dropRoot = firstSegments.size === 1 && wbsOrder.length > 1 ? wbsOrder[0] : null;
  const projectCode = dropRoot ?? null;

  const nodes: ObraNodeDraft[] = [];
  const childrenOf = new Map<string, string[]>();
  for (const c of wbsOrder) {
    if (c === dropRoot) continue;
    const parent = c.includes(".") ? c.slice(0, c.lastIndexOf(".")) : "";
    const key = parent === dropRoot ? "" : parent;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), c]);
  }
  const actsOf = new Map<string, typeof activities>();
  for (const a of activities) {
    const key = a.wbs === dropRoot ? "" : a.wbs;
    actsOf.set(key, [...(actsOf.get(key) ?? []), a]);
  }

  const pushActs = (wbs: string, parentRef: string | null, depth: number) => {
    for (const a of actsOf.get(wbs) ?? []) {
      const [cStart, cEnd] = orderDates(a.cs, a.ce);
      const [bStart, bEnd] = orderDates(a.bs, a.be);
      nodes.push({
        ref: `t:${a.id}`,
        parent_ref: parentRef,
        kind: "actividad",
        external_id: a.id,
        code: a.id.includes(":") ? a.name.slice(0, 20) : a.id,
        name: a.name,
        current_start: cStart,
        current_end: cEnd,
        baseline_start: bStart,
        baseline_end: bEnd,
        depth,
      });
    }
  };
  const walk = (parent: string, parentRef: string | null, depth: number) => {
    for (const c of childrenOf.get(parent) ?? []) {
      const ref = `w:${c}`;
      const short = c.slice(c.lastIndexOf(".") + 1);
      nodes.push({
        ref,
        parent_ref: parentRef,
        kind: "wbs",
        // Sin el código del proyecto adelante, igual que en el .xer: así se puede actualizar con cualquiera de los dos.
        external_id: dropRoot ? c.slice(dropRoot.length + 1) : c,
        code: short,
        name: wbsNames.get(c) || short,
        current_start: null,
        current_end: null,
        baseline_start: null,
        baseline_end: null,
        depth,
      });
      walk(c, ref, depth + 1);
      pushActs(c, ref, depth + 1);
    }
  };
  walk("", null, 0);
  pushActs("", null, 0);

  const baseName = fileName.replace(/\.[^.]+$/, "");
  return {
    ok: true,
    format: "csv",
    projects: [{ key: "csv", name: (dropRoot && wbsNames.get(dropRoot)) || baseName || "Obra", code: projectCode, nodes }],
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------------------

export function parsePrimavera(text: string, fileName = ""): PrimaveraResult {
  const clean = text.replace(/^﻿/, "");
  let result: PrimaveraResult;
  if (/^ERMHDR/m.test(clean.slice(0, 200)) || clean.includes("\n%T\t")) {
    result = parseXer(clean);
  } else {
    const rows = clean.includes("\t") && !/\.csv$/i.test(fileName) ? parsePastedTable(clean) : parseCsv(clean);
    result = parseCsvPlan(rows, fileName);
  }
  if (result.ok) {
    const tooBig = result.projects.find((p) => p.nodes.length > MAX_OBRA_NODES);
    if (tooBig) return { ok: false, error: `El plan tiene ${tooBig.nodes.length} ítems; el máximo es ${MAX_OBRA_NODES}.` };
  }
  return result;
}

/** Rango de fechas (vigentes) de todo el plan, para la vista previa. */
export function planRange(nodes: ObraNodeDraft[]): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end: string | null = null;
  for (const n of nodes) {
    if (n.current_start && (!start || n.current_start < start)) start = n.current_start;
    if (n.current_end && (!end || n.current_end > end)) end = n.current_end;
  }
  return { start, end };
}
