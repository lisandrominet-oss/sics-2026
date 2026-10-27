"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button, { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import AssignmentEditForm from "@/components/AssignmentEditForm";
import RosterDayPanel, { type PanelPerson } from "@/components/RosterDayPanel";
import { notify } from "@/lib/notify";
import { formatSqlDate } from "@/lib/constants";
import {
  DAY_STATE_LABELS,
  SHIFT_LABELS,
  WORK_STATES,
  addDays,
  cellStyle,
  dayOfMonth,
  dayRange,
  employeeLabel,
  formatHours,
  isWeekend,
  longDate,
  monthLabel,
  weekdayLetter,
  type DayState,
  type RosterActualRow,
  type RosterAssignment,
  type RosterCrew,
  type RosterEmployeeOption,
  type RosterException,
  type RosterPosition,
  type RosterSite,
  type Shift,
} from "@/lib/roster";

type GroupBy = "cuadrilla" | "puesto" | "ninguno";
type ViewMode = "real" | "plan" | "dif";
type Person = PanelPerson & { legajo: string | null; position: string | null; pattern: string | null; assignment: RosterAssignment };
type Target = { person: Person; day: string } | null;

const MODES: { key: ViewMode; label: string; hint: string }[] = [
  { key: "real", label: "Real", hint: "Lo registrado; donde todavía no se confirmó, lo planificado" },
  { key: "plan", label: "Planificado", hint: "El ciclo más las excepciones cargadas" },
  { key: "dif", label: "Diferencias", hint: "Solo los días registrados que difieren del plan" },
];

const LEGEND: { state: string; shift: string | null; label: string }[] = [
  { state: "trabajo", shift: "dia", label: "Trabajo de día" },
  { state: "trabajo", shift: "noche", label: "Trabajo de noche" },
  { state: "franco", shift: null, label: "Franco" },
  { state: "viaje_subida", shift: null, label: "Subida" },
  { state: "viaje_bajada", shift: null, label: "Bajada" },
  { state: "vacaciones", shift: null, label: "Vacaciones" },
  { state: "licencia", shift: null, label: "Licencia" },
  { state: "enfermedad", shift: null, label: "Enfermedad" },
  { state: "ausencia", shift: null, label: "Ausencia" },
  { state: "bajada_anticipada", shift: null, label: "Bajada anticipada" },
  { state: "subida_demorada", shift: null, label: "Subida demorada" },
  { state: "capacitacion", shift: null, label: "Capacitación" },
  { state: "suspension", shift: null, label: "Suspensión" },
  { state: "accidente_art", shift: null, label: "Accidente / ART" },
];

export default function RosterGrid({
  sites,
  siteId,
  from,
  days,
  today,
  assignments,
  states,
  exceptions,
  positions,
  crews,
  options,
  required,
}: {
  sites: RosterSite[];
  siteId: string;
  from: string;
  days: number;
  today: string;
  assignments: RosterAssignment[];
  states: RosterActualRow[];
  exceptions: RosterException[];
  positions: RosterPosition[];
  crews: RosterCrew[];
  options: RosterEmployeeOption[];
  required: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [groupBy, setGroupBy] = useState<GroupBy>("cuadrilla");
  const [mode, setMode] = useState<ViewMode>("real");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target>(null);
  const [lastTarget, setLastTarget] = useState<Target>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [lastEditing, setLastEditing] = useState<Person | null>(null);
  const [confirming, setConfirming] = useState(false);
  const shownTarget = target ?? lastTarget;
  const shownEditing = editing ?? lastEditing;

  const range = useMemo(() => dayRange(from, days), [from, days]);
  const to = range[range.length - 1];
  const planMode = mode === "plan";

  // Filas por persona y por día, y feriados del período (un feriado se ve en el encabezado de la columna).
  const byEmployee = useMemo(() => {
    const m = new Map<string, Map<string, RosterActualRow>>();
    for (const r of states) {
      let inner = m.get(r.employee_id);
      if (!inner) m.set(r.employee_id, (inner = new Map()));
      inner.set(r.day, r);
    }
    return m;
  }, [states]);

  const holidays = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of states) if (r.is_holiday && r.holiday_name && !m.has(r.day)) m.set(r.day, r.holiday_name);
    return m;
  }, [states]);

  // Una fila por empleado, con su asignación más reciente del período (no la primera que aparezca).
  const people = useMemo(() => {
    const latest = new Map<string, RosterAssignment>();
    for (const a of assignments) {
      const cur = latest.get(a.employee_id);
      if (!cur || a.valid_from > cur.valid_from) latest.set(a.employee_id, a);
    }
    const q = query.trim().toLowerCase();
    return [...latest.values()]
      .map(
        (a): Person => ({
          employeeId: a.employee_id,
          label: employeeLabel(a),
          legajo: a.legajo,
          crew: a.crew_name,
          position: a.position_name,
          pattern: a.pattern_name,
          assignment: a,
        })
      )
      .filter((p) => !q || `${p.label} ${p.legajo ?? ""} ${p.position ?? ""} ${p.crew ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [assignments, query]);

  const sections = useMemo(() => {
    if (groupBy === "ninguno") return [{ title: null as string | null, people }];
    const key = (p: Person) => (groupBy === "cuadrilla" ? p.crew : p.position) ?? (groupBy === "cuadrilla" ? "Sin cuadrilla" : "Sin puesto");
    const map = new Map<string, Person[]>();
    for (const p of people) {
      const k = key(p);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a.startsWith("Sin ") ? 1 : b.startsWith("Sin ") ? -1 : a.localeCompare(b, "es")))
      .map(([title, list]) => ({ title, people: list }));
  }, [people, groupBy]);

  const stateOf = (r: RosterActualRow) => (planMode ? r.plan_state : r.state);

  // Totales por día. "Trabajando" y la cobertura cuentan a toda la gente del sitio (no solo a la que filtra el buscador).
  const totals = useMemo(() => {
    const visible = new Set(people.map((p) => p.employeeId));
    return range.map((d) => {
      let working = 0;
      let allWorking = 0;
      let travelling = 0;
      for (const [id, inner] of byEmployee) {
        const r = inner.get(d);
        if (!r) continue;
        const st = planMode ? r.plan_state : r.state;
        if (st === "trabajo") {
          allWorking += 1;
          if (visible.has(id)) working += 1;
        } else if (visible.has(id) && (st === "viaje_subida" || st === "viaje_bajada")) travelling += 1;
      }
      return { working, allWorking, travelling };
    });
  }, [people, range, byEmployee, planMode]);

  // Totales por persona de lo que muestra la vista (en "Real", los días sin confirmar cuentan según el plan).
  const personTotals = useMemo(() => {
    const m = new Map<string, { days: number; hours: number; extra: number }>();
    for (const p of people) {
      let d = 0;
      let h = 0;
      let x = 0;
      for (const r of byEmployee.get(p.employeeId)?.values() ?? []) {
        if (WORK_STATES.includes(stateOf(r))) d += 1;
        if (!planMode) {
          h += r.hours_normal + r.hours_extra50 + r.hours_extra100 + r.hours_travel;
          x += r.hours_extra50 + r.hours_extra100;
        }
      }
      m.set(p.employeeId, { days: d, hours: h, extra: x });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, byEmployee, planMode]);

  const pending = useMemo(() => {
    let n = 0;
    for (const r of states) if (!r.confirmed && r.day <= today && r.state !== "franco") n += 1;
    return n;
  }, [states, today]);

  const months = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const d of range) {
      const label = monthLabel(d);
      const last = out[out.length - 1];
      if (last && last.label === label) last.span += 1;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [range]);

  function go(params: { sitio?: string; desde?: string; dias?: number }) {
    const sp = new URLSearchParams();
    sp.set("sitio", params.sitio ?? siteId);
    sp.set("desde", params.desde ?? from);
    sp.set("dias", String(params.dias ?? days));
    router.push(`/roster?${sp.toString()}`);
  }
  const hrefFor = (desde: string) => `/roster?sitio=${siteId}&desde=${desde}&dias=${days}`;

  function openCell(person: Person, day: string) {
    const t = { person, day };
    setTarget(t);
    setLastTarget(t);
  }

  function openEdit(person: Person) {
    setEditing(person);
    setLastEditing(person);
  }

  async function confirmPending() {
    const upTo = to < today ? to : today;
    const ok = await confirm({
      title: "¿Confirmar el período como planificado?",
      description: `${pending === 1 ? "El día sin confirmar" : `Los ${pending} días sin confirmar`} hasta el ${formatSqlDate(upTo)} se registra${pending === 1 ? "" : "n"} tal como ${pending === 1 ? "estaba planificado" : "estaban planificados"} (estado y horas según las reglas de pago). Después corregís solo los desvíos. Queda registrado.`,
      confirmLabel: "Confirmar",
    });
    if (!ok) return;
    setConfirming(true);
    const { data, error } = await createClient().rpc("roster_confirm_range", { p_from: from, p_to: upTo, p_site_id: siteId });
    setConfirming(false);
    if (error) return notify.error("No se pudo confirmar", error.message);
    notify.success(data === 1 ? "1 día confirmado" : `${data} días confirmados`);
    router.refresh();
  }

  const cellOf = (p: Person, d: string) => byEmployee.get(p.employeeId)?.get(d);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={siteId}
            onChange={(e) => go({ sitio: e.target.value })}
            aria-label="Sitio"
            className="w-full max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => go({ dias: Number(e.target.value) })}
            aria-label="Período"
            className="w-full max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
          >
            {[14, 28, 42, 56].map((n) => (
              <option key={n} value={n}>
                {n} días
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Link href={hrefFor(addDays(from, -days))} className={buttonClass({ variant: "secondary", size: "sm" })} aria-label="Período anterior">
              ←
            </Link>
            <Link href={`/roster?sitio=${siteId}&dias=${days}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              Hoy
            </Link>
            <Link href={hrefFor(addDays(from, days))} className={buttonClass({ variant: "secondary", size: "sm" })} aria-label="Período siguiente">
              →
            </Link>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div role="group" aria-label="Vista del calendario" className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                title={m.hint}
                onClick={() => setMode(m.key)}
                className={`px-3 py-2 ${mode === m.key ? "bg-ink text-on-ink" : "bg-sheet text-slate-600 hover:bg-slate-50"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar persona"
            aria-label="Buscar persona"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-48"
          />
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} aria-label="Agrupar por" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="cuadrilla">Agrupar por cuadrilla</option>
            <option value="puesto">Agrupar por puesto</option>
            <option value="ninguno">Sin agrupar</option>
          </select>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Referencias">
        {LEGEND.map((l) => {
          const st = cellStyle(l.state, l.shift);
          return (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[10px] font-semibold ${st.className}`}>{st.code}</span>
              {l.label}
            </li>
          );
        })}
      </ul>

      {!planMode && pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Hay <strong>{pending}</strong> {pending === 1 ? "día de este período que ya pasó y no está confirmado" : "días de este período que ya pasaron y no están confirmados"} (se {pending === 1 ? "ve atenuado" : "ven atenuados"}).
          </p>
          <Button size="sm" variant="secondary" onClick={confirmPending} loading={confirming}>
            Confirmar como planificado
          </Button>
        </div>
      )}

      {people.length === 0 ? (
        <EmptyState
          title="No hay personas asignadas a este sitio en el período"
          description="Asigná personas con su régimen y fecha de inicio del ciclo para que aparezcan en el calendario."
          action={
            <Link href="/roster/asignaciones" className="text-sm font-medium text-indigo-600 hover:underline">
              Ir a Asignaciones
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-sheet">
          <table className="border-separate border-spacing-0 text-xs">
            <caption className="sr-only">Calendario de rotaciones del sitio: una fila por persona y una columna por día</caption>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[12rem] border-b border-slate-100 bg-sheet px-3 py-1 text-left font-medium text-slate-500" rowSpan={2}>
                  Persona
                </th>
                {months.map((m) => (
                  <th key={m.label} colSpan={m.span} className="border-b border-l border-slate-100 px-1 py-1 text-left font-medium text-slate-600">
                    {m.span >= 3 ? m.label : ""}
                  </th>
                ))}
                <th colSpan={planMode ? 1 : 3} className="border-b border-l border-slate-100 px-2 py-1 text-left font-medium text-slate-600">
                  Período
                </th>
              </tr>
              <tr>
                {range.map((d) => {
                  const holiday = holidays.get(d);
                  return (
                    <th
                      key={d}
                      scope="col"
                      title={holiday ? `${longDate(d)} · Feriado: ${holiday}` : longDate(d)}
                      className={`min-w-[2rem] border-b border-slate-100 px-0.5 py-1 text-center font-normal tabular-nums ${
                        d === today
                          ? "bg-indigo-100 font-semibold text-indigo-800"
                          : holiday
                            ? "bg-rose-50 font-semibold text-rose-700"
                            : isWeekend(d)
                              ? "bg-slate-50 text-slate-500"
                              : "text-slate-500"
                      }`}
                    >
                      <div className="text-[10px] leading-none">{weekdayLetter(d)}</div>
                      <div className="leading-tight">{dayOfMonth(d)}</div>
                      {holiday && <div aria-hidden="true" className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-rose-500" />}
                    </th>
                  );
                })}
                <th scope="col" className="min-w-[3rem] border-b border-l border-slate-100 px-2 py-1 text-center font-medium text-slate-500" title="Días trabajando">
                  Días
                </th>
                {!planMode && (
                  <>
                    <th scope="col" className="min-w-[3rem] border-b border-slate-100 px-2 py-1 text-center font-medium text-slate-500" title="Horas de trabajo y de viaje">
                      Horas
                    </th>
                    <th scope="col" className="min-w-[3rem] border-b border-slate-100 px-2 py-1 text-center font-medium text-slate-500" title="Horas extra (50% y 100%)">
                      Extra
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <SectionRows
                  key={section.title ?? "todos"}
                  title={section.title}
                  people={section.people}
                  range={range}
                  today={today}
                  mode={mode}
                  cellOf={cellOf}
                  totals={personTotals}
                  colSpan={range.length + (planMode ? 2 : 4)}
                  from={from}
                  to={to}
                  onCell={openCell}
                  onPerson={openEdit}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky left-0 z-10 border-t border-slate-200 bg-sheet px-3 py-1.5 text-left font-medium text-slate-600">Trabajando</th>
                {totals.map((t, i) => (
                  <td key={range[i]} className="border-t border-slate-200 px-0.5 py-1.5 text-center font-semibold tabular-nums text-slate-800">
                    {t.working}
                  </td>
                ))}
                <td colSpan={planMode ? 1 : 3} className="border-t border-slate-200" />
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-sheet px-3 py-1 text-left font-normal text-slate-500">En viaje (sube o baja)</th>
                {totals.map((t, i) => (
                  <td key={range[i]} className="px-0.5 py-1 text-center tabular-nums text-slate-500">
                    {t.travelling || ""}
                  </td>
                ))}
                <td colSpan={planMode ? 1 : 3} />
              </tr>
              {required > 0 && (
                <tr>
                  <th className="sticky left-0 z-10 bg-sheet px-3 py-1 text-left font-normal text-slate-500" title="Suma de la dotación requerida de los puestos del sitio">
                    Cobertura (requiere {required})
                  </th>
                  {totals.map((t, i) => {
                    const gap = required - t.allWorking;
                    return (
                      <td key={range[i]} className={`px-0.5 py-1 text-center text-[10px] tabular-nums ${gap > 0 ? "font-semibold text-red-600" : "text-slate-400"}`} title={gap > 0 ? `Faltan ${gap}` : gap < 0 ? `Sobran ${-gap}` : "Dotación completa"}>
                        {gap > 0 ? `-${gap}` : gap < 0 ? `+${-gap}` : "✓"}
                      </td>
                    );
                  })}
                  <td colSpan={planMode ? 1 : 3} />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Del {formatSqlDate(from)} al {formatSqlDate(to)}. Tocá una celda para confirmar el día, cargar horas reales o un evento (vacaciones, licencia, bajada anticipada, extensión…); tocá un nombre para cambiar su puesto o cuadrilla.
        {!planMode && " Atenuado: ya pasó y no está confirmado. Borde naranja: difiere del plan. *: extensión de ciclo."}
      </p>

      <Modal open={target !== null} onClose={() => setTarget(null)} title={shownTarget ? `${shownTarget.person.label} · ${longDate(shownTarget.day)}` : ""} className="sm:max-w-xl">
        {shownTarget && (
          <RosterDayPanel
            key={`${shownTarget.person.employeeId}-${shownTarget.day}`}
            person={shownTarget.person}
            day={shownTarget.day}
            today={today}
            cell={cellOf(shownTarget.person, shownTarget.day)}
            exceptions={exceptions.filter((x) => x.employee_id === shownTarget.person.employeeId && x.date_from <= to && x.date_to >= from)}
            options={options}
            onDone={() => setTarget(null)}
          />
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Puesto y cuadrilla">
        {shownEditing && (
          <AssignmentEditForm
            key={shownEditing.assignment.id}
            assignment={shownEditing.assignment}
            positions={positions}
            crews={crews}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function SectionRows({
  title,
  people,
  range,
  today,
  mode,
  cellOf,
  totals,
  colSpan,
  from,
  to,
  onCell,
  onPerson,
}: {
  title: string | null;
  people: Person[];
  range: string[];
  today: string;
  mode: ViewMode;
  cellOf: (p: Person, d: string) => RosterActualRow | undefined;
  totals: Map<string, { days: number; hours: number; extra: number }>;
  colSpan: number;
  from: string;
  to: string;
  onCell: (person: Person, day: string) => void;
  onPerson: (person: Person) => void;
}) {
  const planMode = mode === "plan";
  return (
    <>
      {title && (
        <tr>
          <th colSpan={colSpan} scope="colgroup" className="sticky left-0 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-left text-xs font-semibold text-slate-700">
            {title} <span className="font-normal text-slate-400">({people.length})</span>
          </th>
        </tr>
      )}
      {people.map((p) => {
        const a = p.assignment;
        const tot = totals.get(p.employeeId);
        const ends = a.valid_to && a.valid_to <= to ? `Termina el ${formatSqlDate(a.valid_to)}` : null;
        const starts = a.valid_from > from ? `Empieza el ${formatSqlDate(a.valid_from)}` : null;
        return (
          <tr key={p.employeeId}>
            <th scope="row" className="sticky left-0 z-10 max-w-[14rem] border-t border-slate-100 bg-sheet px-3 py-1 text-left font-normal">
              <button type="button" onClick={() => onPerson(p)} title="Cambiar puesto o cuadrilla" className="block max-w-full truncate text-left text-xs font-medium text-slate-900 hover:underline">
                {p.label}
              </button>
              <p className="truncate text-[10px] text-slate-400">{[p.position, p.pattern, ends ?? starts].filter(Boolean).join(" · ")}</p>
            </th>
            {range.map((d) => {
              const cell = cellOf(p, d);
              if (!cell) {
                return (
                  <td key={d} className="border-t border-slate-100 p-0">
                    <button
                      type="button"
                      onClick={() => onCell(p, d)}
                      aria-label={`${p.label}, ${longDate(d)}: sin asignación`}
                      className="h-7 w-full text-slate-200 hover:bg-slate-50"
                    >
                      ·
                    </button>
                  </td>
                );
              }
              const state = planMode ? cell.plan_state : cell.state;
              const shift = planMode ? cell.plan_shift : cell.shift;
              const st = cellStyle(state, shift);
              const isPending = !planMode && !cell.confirmed && d <= today && state !== "franco";
              const isDiff = !planMode && cell.differs;
              const dim = mode === "dif" && !cell.differs;
              const hours = cell.hours_normal + cell.hours_extra50 + cell.hours_extra100 + cell.hours_travel;
              const label = `${DAY_STATE_LABELS[state as DayState] ?? state}${shift ? ` de ${SHIFT_LABELS[shift as Shift].toLowerCase()}` : ""}${cell.extended && state === "trabajo" ? " (extensión)" : ""}`;
              const detail = [
                label,
                !planMode && hours > 0 ? `${formatHours(hours)} h` : null,
                !planMode ? (cell.confirmed ? "confirmado" : d <= today && state !== "franco" ? "sin confirmar" : null) : null,
                isDiff ? "difiere del plan" : null,
                cell.is_holiday ? `feriado: ${cell.holiday_name}` : null,
                cell.closed ? "período cerrado" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <td key={d} className={`border-t border-slate-100 p-0 ${d === today ? "outline outline-1 -outline-offset-1 outline-indigo-400" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onCell(p, d)}
                    title={`${longDate(d)}: ${detail}`}
                    aria-label={`${p.label}, ${longDate(d)}: ${detail}`}
                    className={`flex h-7 w-full items-center justify-center text-[11px] font-semibold ${st.className} hover:brightness-95 ${isPending ? "opacity-50" : ""} ${dim ? "opacity-20" : ""} ${isDiff ? "ring-2 ring-inset ring-orange-500" : ""}`}
                  >
                    {st.code}
                    {cell.extended && state === "trabajo" && <span aria-hidden="true">*</span>}
                  </button>
                </td>
              );
            })}
            <td className="border-l border-t border-slate-100 px-2 text-center tabular-nums text-slate-700">{tot?.days ?? 0}</td>
            {!planMode && (
              <>
                <td className="border-t border-slate-100 px-2 text-center tabular-nums text-slate-700">{formatHours(tot?.hours ?? 0)}</td>
                <td className="border-t border-slate-100 px-2 text-center tabular-nums text-slate-500">{tot?.extra ? formatHours(tot.extra) : ""}</td>
              </>
            )}
          </tr>
        );
      })}
    </>
  );
}
