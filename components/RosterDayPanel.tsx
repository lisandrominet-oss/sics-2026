"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { notify } from "@/lib/notify";
import { formatDate, formatSqlDate } from "@/lib/constants";
import { inputClass, labelClass } from "@/lib/ui";
import {
  DAY_STATE_LABELS,
  EXCEPTION_KIND_LABELS,
  HOURS_STATES,
  REASON_LABELS,
  SHIFT_LABELS,
  WORK_STATES,
  employeeLabel,
  formatHours,
  isIsoDate,
  type DayState,
  type ExceptionKind,
  type RosterActualRow,
  type RosterEmployeeOption,
  type RosterEvent,
  type RosterException,
  type Shift,
} from "@/lib/roster";

type Tab = "dia" | "periodo" | "historial";

export type PanelPerson = { employeeId: string; label: string; crew: string | null };

const TABS: { key: Tab; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "periodo", label: "Período" },
  { key: "historial", label: "Historial" },
];

const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n)));

function describeState(state: string, shift: string | null) {
  return `${DAY_STATE_LABELS[state as DayState] ?? state}${shift ? ` de ${SHIFT_LABELS[shift as Shift].toLowerCase()}` : ""}`;
}

// Panel de una celda del calendario: lo que pasó ese día (estado y horas reales), eventos por período
// (vacaciones, licencias, bajada anticipada, extensión, reemplazos) e historial de cambios de la persona.
export default function RosterDayPanel({
  person,
  day,
  today,
  cell,
  exceptions,
  options,
  onDone,
}: {
  person: PanelPerson;
  day: string;
  today: string;
  cell: RosterActualRow | undefined;
  exceptions: RosterException[];
  options: RosterEmployeeOption[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("dia");
  return (
    <div className="mt-3 space-y-4">
      <div role="tablist" aria-label="Secciones del día" className="flex gap-4 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-2 text-sm font-semibold ${tab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dia" && <DayTab person={person} day={day} today={today} cell={cell} onDone={onDone} />}
      {tab === "periodo" && <PeriodTab person={person} day={day} exceptions={exceptions} options={options} onDone={onDone} />}
      {tab === "historial" && <HistoryTab employeeId={person.employeeId} />}
    </div>
  );
}

function DayTab({ person, day, today, cell, onDone }: { person: PanelPerson; day: string; today: string; cell: RosterActualRow | undefined; onDone: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, setState] = useState<string>(cell?.state ?? "trabajo");
  const [shift, setShift] = useState<string>(cell?.shift ?? "dia");
  const [normal, setNormal] = useState(num(cell?.hours_normal));
  const [extra50, setExtra50] = useState(num(cell?.hours_extra50));
  const [extra100, setExtra100] = useState(num(cell?.hours_extra100));
  const [night, setNight] = useState(num(cell?.hours_night));
  const [travel, setTravel] = useState(num(cell?.hours_travel));
  const [reason, setReason] = useState(cell?.reason ?? "");
  const [note, setNote] = useState(cell?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = !cell
    ? "Ese día la persona no tiene una asignación vigente."
    : day > today
      ? "Ese día todavía no pasó. Para anticipar vacaciones, licencias u otros eventos usá la pestaña «Período»."
      : cell.closed
        ? "Ese día pertenece a un período cerrado: reabrilo desde la pestaña Horas para modificarlo."
        : null;
  const withHours = HOURS_STATES.includes(state);

  // Al cambiar el estado las horas se vuelven "auto": la base las calcula según las reglas de pago (feriado, turno, viaje).
  function changeState(next: string) {
    setState(next);
    setNormal("");
    setExtra50("");
    setExtra100("");
    setNight("");
    setTravel("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().rpc("roster_save_day_record", {
      p_employee_id: person.employeeId,
      p_day: day,
      p_data: {
        state,
        shift: WORK_STATES.includes(state) ? shift : "",
        hours_normal: withHours ? normal : "",
        hours_extra50: withHours ? extra50 : "",
        hours_extra100: withHours ? extra100 : "",
        hours_night: withHours ? night : "",
        hours_travel: withHours ? travel : "",
        reason,
        note,
      },
    });
    setBusy(false);
    if (err) return setError(err.message);
    notify.success("Día registrado");
    router.refresh();
    onDone();
  }

  async function backToPlan() {
    const ok = await confirm({
      title: "¿Volver al plan?",
      description: "Se quita lo registrado de ese día y vuelve a mostrarse lo planificado. Queda en el historial.",
      confirmLabel: "Volver al plan",
      destructive: true,
    });
    if (!ok) return;
    const { error: err } = await createClient().rpc("roster_delete_day_record", { p_employee_id: person.employeeId, p_day: day });
    if (err) return notify.error("No se pudo quitar", err.message);
    notify.success("Volvió al plan");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1 text-sm text-slate-600">
        {cell ? (
          <>
            <p>
              <span className="font-medium text-slate-800">Plan:</span> {describeState(cell.plan_state, cell.plan_shift)}
              {cell.extended ? " (extensión de ciclo)" : ""}
              {cell.base_state !== cell.plan_state ? ` · el ciclo decía: ${DAY_STATE_LABELS[cell.base_state as DayState] ?? cell.base_state}` : ""}
            </p>
            <p>
              <span className="font-medium text-slate-800">Real:</span>{" "}
              {cell.confirmed ? describeState(cell.state, cell.shift) : day > today ? "todavía no pasó" : "sin confirmar"}
              {cell.confirmed && cell.differs ? " · difiere del plan" : ""}
            </p>
            {cell.is_holiday && <p className="text-red-700">Feriado: {cell.holiday_name}</p>}
          </>
        ) : (
          <p>Ese día la persona no tiene una asignación vigente.</p>
        )}
        {person.crew && <p>Cuadrilla: {person.crew}.</p>}
      </div>

      {blocked ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{blocked}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Estado real</label>
              <select value={state} onChange={(e) => changeState(e.target.value)} className={inputClass}>
                {Object.entries(DAY_STATE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {WORK_STATES.includes(state) && (
              <div>
                <label className={labelClass}>Turno</label>
                <select
                  value={shift}
                  onChange={(e) => {
                    setShift(e.target.value);
                    // Las horas nocturnas dependen del turno: vuelven a "auto".
                    setNight("");
                  }}
                  className={inputClass}
                >
                  {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {withHours && (
            <div>
              <p className="text-xs font-medium text-slate-700">Horas (vacío = automático según las reglas de pago)</p>
              <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: "Normales", value: normal, set: setNormal },
                  { label: "Extra 50%", value: extra50, set: setExtra50 },
                  { label: "Extra 100%", value: extra100, set: setExtra100 },
                  { label: "Nocturnas", value: night, set: setNight },
                  { label: "Viaje", value: travel, set: setTravel },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[11px] text-slate-500">{f.label}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={24}
                      step={0.25}
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder="auto"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Las nocturnas son parte de las trabajadas (no se suman).</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Motivo (si se desvió del plan)</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
                <option value="">Sin motivo</option>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Nota (opcional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
            </div>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!blocked && cell?.confirmed && (
            <Button variant="link-danger" size="sm" onClick={backToPlan} disabled={busy}>
              Volver al plan
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone} disabled={busy}>
            Cerrar
          </Button>
          {!blocked && (
            <Button type="submit" loading={busy}>
              {cell?.confirmed ? "Guardar cambios" : "Confirmar día"}
            </Button>
          )}
        </div>
      </div>
      {cell && !blocked && (
        <p className="text-xs text-slate-500">
          Horas del plan para ese día: {formatHours(cell.hours_normal + cell.hours_extra50 + cell.hours_extra100)} de trabajo
          {cell.hours_travel > 0 ? ` y ${formatHours(cell.hours_travel)} de viaje` : ""} (según las reglas de Configuración).
        </p>
      )}
    </form>
  );
}

function PeriodTab({
  person,
  day,
  exceptions,
  options,
  onDone,
}: {
  person: PanelPerson;
  day: string;
  exceptions: RosterException[];
  options: RosterEmployeeOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [kind, setKind] = useState<ExceptionKind>("vacaciones");
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);
  const [reason, setReason] = useState("");
  const [covers, setCovers] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const covering = exceptions.filter((x) => x.date_from <= day && x.date_to >= day);
  const nameOf = (id: string | null) => {
    const o = options.find((x) => x.id === id);
    return o ? employeeLabel(o) : null;
  };

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
      p_covers_employee_id: kind === "extension" && covers ? covers : undefined,
      p_reason: reason || undefined,
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
    <div className="space-y-4">
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
                    {x.reason ? ` · ${REASON_LABELS[x.reason as keyof typeof REASON_LABELS] ?? x.reason}` : ""}
                    {x.covers_employee_id ? ` · reemplaza a ${nameOf(x.covers_employee_id) ?? "otra persona"}` : ""}
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

      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs font-medium text-slate-700">Cargar un evento para {person.label}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div>
            <label className={labelClass}>Motivo (opcional)</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
              <option value="">Sin motivo</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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
        {kind === "extension" && (
          <div>
            <label className={labelClass}>Se queda en lugar de (opcional)</label>
            <select value={covers} onChange={(e) => setCovers(e.target.value)} className={inputClass}>
              <option value="">Nadie en particular</option>
              {options
                .filter((o) => o.id !== person.employeeId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {employeeLabel(o)}
                  </option>
                ))}
            </select>
          </div>
        )}
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
            Cargar evento
          </Button>
        </div>
      </form>
    </div>
  );
}

const ENTITY_LABELS: Record<string, string> = { registro: "Día", excepcion: "Excepción", asignacion: "Asignación" };
// Participio según el género de lo que cambió ("Día cargado", "Excepción cargada").
const EVENT_LABELS: Record<string, [string, string]> = {
  alta: ["cargado", "cargada"],
  edicion: ["modificado", "modificada"],
  baja: ["quitado", "quitada"],
  cambio: ["cambiado", "cambiada"],
  anulacion: ["anulado", "anulada"],
};

function describeEvent(e: RosterEvent) {
  const v = (e.new_value ?? e.old_value) as Record<string, unknown> | null;
  const text = (k: string) => (v && typeof v[k] === "string" ? (v[k] as string) : null);
  let detail = "";
  if (e.entity === "registro" && text("day")) {
    detail = `${formatSqlDate(text("day")!)} · ${DAY_STATE_LABELS[text("state") as DayState] ?? text("state") ?? ""}`;
  } else if (e.entity === "excepcion" && text("date_from")) {
    detail = `${EXCEPTION_KIND_LABELS[text("kind") as ExceptionKind] ?? text("kind") ?? ""} · ${formatSqlDate(text("date_from")!)} → ${formatSqlDate(text("date_to") ?? text("date_from")!)}`;
  } else if (e.entity === "asignacion" && text("valid_from")) {
    detail = `desde ${formatSqlDate(text("valid_from")!)}`;
  }
  return `${ENTITY_LABELS[e.entity] ?? e.entity} ${EVENT_LABELS[e.event_type]?.[e.entity === "registro" ? 0 : 1] ?? e.event_type}${detail ? ` · ${detail}` : ""}${e.note ? ` · ${e.note}` : ""}`;
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const [events, setEvents] = useState<RosterEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("roster_events")
      .select("*")
      .in("entity", ["registro", "excepcion", "asignacion"])
      .or(`new_value->>employee_id.eq.${employeeId},old_value->>employee_id.eq.${employeeId}`)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setEvents(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!events) return <p className="text-sm text-slate-500">Cargando historial…</p>;
  if (events.length === 0) return <p className="text-sm text-slate-500">Todavía no hay cambios registrados para esta persona.</p>;
  return (
    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
      {events.map((e) => (
        <li key={e.id} className="px-3 py-2 text-sm">
          <p className="text-slate-800">{describeEvent(e)}</p>
          <p className="text-xs tabular-nums text-slate-500">{formatDate(e.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
