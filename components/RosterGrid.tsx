"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button, { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { notify } from "@/lib/notify";
import { formatSqlDate } from "@/lib/constants";
import { inputClass, labelClass } from "@/lib/ui";
import {
  DAY_STATE_LABELS,
  EXCEPTION_KIND_LABELS,
  SHIFT_LABELS,
  addDays,
  cellStyle,
  dayOfMonth,
  dayRange,
  employeeLabel,
  isIsoDate,
  isWeekend,
  longDate,
  monthLabel,
  weekdayLetter,
  type DayState,
  type ExceptionKind,
  type RosterAssignment,
  type RosterException,
  type RosterSite,
  type RosterStateRow,
  type Shift,
} from "@/lib/roster";

type GroupBy = "cuadrilla" | "puesto" | "ninguno";
type Person = { employeeId: string; label: string; legajo: string | null; crew: string | null; position: string | null; pattern: string | null };
type Target = { person: Person; day: string } | null;

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
}: {
  sites: RosterSite[];
  siteId: string;
  from: string;
  days: number;
  today: string;
  assignments: RosterAssignment[];
  states: RosterStateRow[];
  exceptions: RosterException[];
}) {
  const router = useRouter();
  const [groupBy, setGroupBy] = useState<GroupBy>("cuadrilla");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target>(null);
  const [lastTarget, setLastTarget] = useState<Target>(null);
  const shownTarget = target ?? lastTarget;

  const range = useMemo(() => dayRange(from, days), [from, days]);
  const to = range[range.length - 1];

  // Estado de cada persona por día, y las personas (una fila por empleado) con los datos de su asignación.
  const byEmployee = useMemo(() => {
    const m = new Map<string, Map<string, RosterStateRow>>();
    for (const r of states) {
      let inner = m.get(r.employee_id);
      if (!inner) m.set(r.employee_id, (inner = new Map()));
      inner.set(r.day, r);
    }
    return m;
  }, [states]);

  const people = useMemo(() => {
    const seen = new Map<string, Person>();
    for (const a of assignments) {
      if (seen.has(a.employee_id)) continue;
      seen.set(a.employee_id, {
        employeeId: a.employee_id,
        label: employeeLabel(a),
        legajo: a.legajo,
        crew: a.crew_name,
        position: a.position_name,
        pattern: a.pattern_name,
      });
    }
    const q = query.trim().toLowerCase();
    return [...seen.values()].filter((p) => !q || `${p.label} ${p.legajo ?? ""} ${p.position ?? ""} ${p.crew ?? ""}`.toLowerCase().includes(q));
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

  // Totales por día (solo de las personas visibles).
  const totals = useMemo(() => {
    const visible = new Set(people.map((p) => p.employeeId));
    return range.map((d) => {
      let working = 0;
      let travelling = 0;
      for (const id of visible) {
        const st = byEmployee.get(id)?.get(d)?.state;
        if (st === "trabajo") working += 1;
        else if (st === "viaje_subida" || st === "viaje_bajada") travelling += 1;
      }
      return { working, travelling };
    });
  }, [people, range, byEmployee]);

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
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${st.className}`}>{st.code}</span>
              {l.label}
            </li>
          );
        })}
      </ul>

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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="border-separate border-spacing-0 text-xs">
            <caption className="sr-only">Calendario de rotaciones del sitio: una fila por persona y una columna por día</caption>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[12rem] border-b border-slate-100 bg-white px-3 py-1 text-left font-medium text-slate-500" rowSpan={2}>
                  Persona
                </th>
                {months.map((m) => (
                  <th key={m.label} colSpan={m.span} className="border-b border-l border-slate-100 px-1 py-1 text-left font-medium text-slate-600">
                    {m.span >= 3 ? m.label : ""}
                  </th>
                ))}
              </tr>
              <tr>
                {range.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    title={longDate(d)}
                    className={`min-w-[2rem] border-b border-slate-100 px-0.5 py-1 text-center font-normal tabular-nums ${
                      d === today ? "bg-indigo-100 font-semibold text-indigo-800" : isWeekend(d) ? "bg-slate-50 text-slate-500" : "text-slate-500"
                    }`}
                  >
                    <div className="text-[10px] leading-none">{weekdayLetter(d)}</div>
                    <div className="leading-tight">{dayOfMonth(d)}</div>
                  </th>
                ))}
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
                  byEmployee={byEmployee}
                  colSpan={range.length + 1}
                  onCell={openCell}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="sticky left-0 z-10 border-t border-slate-200 bg-white px-3 py-1.5 text-left font-medium text-slate-600">Trabajando</th>
                {totals.map((t, i) => (
                  <td key={range[i]} className="border-t border-slate-200 px-0.5 py-1.5 text-center font-semibold tabular-nums text-slate-800">
                    {t.working}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-1 text-left font-normal text-slate-500">En viaje (sube o baja)</th>
                {totals.map((t, i) => (
                  <td key={range[i]} className="px-0.5 py-1 text-center tabular-nums text-slate-500">
                    {t.travelling || ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Del {formatSqlDate(from)} al {formatSqlDate(to)}. Tocá una celda para cargar vacaciones, licencias o una extensión de ciclo.
      </p>

      <Modal open={target !== null} onClose={() => setTarget(null)} title={shownTarget ? `${shownTarget.person.label} · ${longDate(shownTarget.day)}` : ""} className="sm:max-w-lg">
        {shownTarget && (
          <ExceptionPanel
            key={`${shownTarget.person.employeeId}-${shownTarget.day}`}
            person={shownTarget.person}
            day={shownTarget.day}
            cell={byEmployee.get(shownTarget.person.employeeId)?.get(shownTarget.day)}
            exceptions={exceptions.filter((x) => x.employee_id === shownTarget.person.employeeId && x.date_from <= to && x.date_to >= from)}
            onDone={() => setTarget(null)}
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
  byEmployee,
  colSpan,
  onCell,
}: {
  title: string | null;
  people: Person[];
  range: string[];
  today: string;
  byEmployee: Map<string, Map<string, RosterStateRow>>;
  colSpan: number;
  onCell: (person: Person, day: string) => void;
}) {
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
        const row = byEmployee.get(p.employeeId);
        return (
          <tr key={p.employeeId}>
            <th scope="row" className="sticky left-0 z-10 max-w-[14rem] border-t border-slate-100 bg-white px-3 py-1 text-left font-normal">
              <p className="truncate text-xs font-medium text-slate-900" title={p.label}>
                {p.label}
              </p>
              <p className="truncate text-[10px] text-slate-400">{[p.position, p.pattern].filter(Boolean).join(" · ")}</p>
            </th>
            {range.map((d) => {
              const cell = row?.get(d);
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
              const st = cellStyle(cell.state, cell.shift);
              const label = `${DAY_STATE_LABELS[cell.state as DayState] ?? cell.state}${cell.shift ? ` de ${SHIFT_LABELS[cell.shift as Shift].toLowerCase()}` : ""}${cell.extended ? " (extensión)" : ""}`;
              return (
                <td key={d} className={`border-t border-slate-100 p-0 ${d === today ? "outline outline-1 -outline-offset-1 outline-indigo-400" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onCell(p, d)}
                    title={`${longDate(d)}: ${label}`}
                    aria-label={`${p.label}, ${longDate(d)}: ${label}`}
                    className={`flex h-7 w-full items-center justify-center text-[11px] font-semibold ${st.className} hover:brightness-95`}
                  >
                    {st.code}
                    {cell.extended && <span aria-hidden="true">*</span>}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function ExceptionPanel({
  person,
  day,
  cell,
  exceptions,
  onDone,
}: {
  person: Person;
  day: string;
  cell: RosterStateRow | undefined;
  exceptions: RosterException[];
  onDone: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [kind, setKind] = useState<ExceptionKind>("vacaciones");
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const covering = exceptions.filter((x) => x.date_from <= day && x.date_to >= day);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isIsoDate(from) || !isIsoDate(to)) return setError("Completá las fechas");
    setBusy(true);
    const { error: err } = await createClient().rpc("roster_add_exception", {
      p_employee_id: person.employeeId,
      p_kind: kind,
      p_from: from,
      p_to: to,
      p_note: note,
    });
    setBusy(false);
    if (err) return setError(err.message);
    notify.success("Excepción cargada");
    router.refresh();
    onDone();
  }

  async function remove(x: RosterException) {
    const ok = await confirm({
      title: "¿Quitar esta excepción?",
      description: `${EXCEPTION_KIND_LABELS[x.kind as ExceptionKind] ?? x.kind} del ${formatSqlDate(x.date_from)} al ${formatSqlDate(x.date_to)}. El calendario vuelve al ciclo normal. Queda registrado.`,
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
    const { error: err } = await createClient().rpc("roster_delete_exception", { p_id: x.id });
    if (err) return notify.error("No se pudo quitar", err.message);
    notify.success("Excepción quitada");
    router.refresh();
    onDone();
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-slate-600">
        {cell
          ? `Ese día: ${DAY_STATE_LABELS[cell.state as DayState] ?? cell.state}${cell.shift ? ` de ${SHIFT_LABELS[cell.shift as Shift].toLowerCase()}` : ""}${cell.extended ? " (extensión de ciclo)" : ""}.`
          : "Ese día la persona no tiene una asignación vigente."}
        {person.crew ? ` Cuadrilla: ${person.crew}.` : ""}
      </p>

      {covering.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-700">Excepciones que cubren ese día</p>
          <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {covering.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  {EXCEPTION_KIND_LABELS[x.kind as ExceptionKind] ?? x.kind}
                  <span className="block text-xs tabular-nums text-slate-500">
                    {formatSqlDate(x.date_from)} → {formatSqlDate(x.date_to)}
                    {x.note ? ` · ${x.note}` : ""}
                  </span>
                </span>
                <Button variant="link-danger" size="sm" onClick={() => remove(x)}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-700">Agregar una excepción</p>
        <div>
          <label className={labelClass}>Tipo</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as ExceptionKind)} className={inputClass}>
            {Object.entries(EXCEPTION_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Hasta</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Nota (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onDone} disabled={busy}>
            Cerrar
          </Button>
          <Button type="submit" loading={busy}>
            Agregar excepción
          </Button>
        </div>
      </form>
    </div>
  );
}
