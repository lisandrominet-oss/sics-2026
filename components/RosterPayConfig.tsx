"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmployeePicker from "@/components/ui/EmployeePicker";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { FormShell, Section, useSave } from "@/components/RosterConfig";
import { notify } from "@/lib/notify";
import { formatSqlDate } from "@/lib/constants";
import { inputClass, labelClass } from "@/lib/ui";
import {
  employeeLabel,
  formatMoney,
  type RosterEmployeeOption,
  type RosterHoliday,
  type RosterPayRules,
  type RosterRateRow,
  type RosterSite,
} from "@/lib/roster";

const SCOPE_LABELS: Record<string, string> = { nacional: "Nacional", provincial: "Provincial", sitio: "De un sitio" };

// Feriados, reglas de reparto de horas y precios por hora. Todo va por RPC de la base y deja registro.
export default function RosterPayConfig({
  sites,
  holidays,
  payRules,
  shiftHours,
  rates,
  categories,
  options,
  year,
}: {
  sites: RosterSite[];
  holidays: RosterHoliday[];
  payRules: RosterPayRules;
  shiftHours: number;
  rates: RosterRateRow[];
  categories: string[];
  options: RosterEmployeeOption[];
  year: number;
}) {
  return (
    <div className="space-y-6">
      <PayRulesSection payRules={payRules} shiftHours={shiftHours} />
      <HolidaysSection sites={sites} holidays={holidays} year={year} />
      <RatesSection rates={rates} categories={categories} options={options} />
    </div>
  );
}

// ---------------------------------------------------------------- reglas de pago
function PayRulesSection({ payRules, shiftHours }: { payRules: RosterPayRules; shiftHours: number }) {
  const router = useRouter();
  const [shift, setShift] = useState(String(shiftHours));
  const [normal, setNormal] = useState(String(Number(payRules.normal_hours_per_day)));
  const [weekday, setWeekday] = useState(String(payRules.weekday_extra_pct));
  const [holiday, setHoliday] = useState(String(payRules.holiday_extra_pct));
  const [holidayAll, setHolidayAll] = useState(payRules.holiday_all_hours);
  const [sunday, setSunday] = useState(payRules.sunday_as_holiday);
  const [travel, setTravel] = useState(String(Number(payRules.travel_day_hours)));
  const [nightStart, setNightStart] = useState(payRules.night_start.slice(0, 5));
  const [nightEnd, setNightEnd] = useState(payRules.night_end.slice(0, 5));
  const { busy, error, save } = useSave(() => router.refresh());

  return (
    <Section
      title="Reglas de pago y horas"
      description="Cómo se reparten las horas de un día trabajado. Son valores de partida, no de ley: validalos con RRHH o el contador según el convenio que rija. Cada cambio queda registrado. Ojo: cambiar los recargos recalcula el costo de cualquier período, también de los cerrados (las horas guardadas no cambian)."
    >
      <FormShell
        busy={busy}
        error={error}
        onCancel={() => {
          setShift(String(shiftHours));
          setNormal(String(Number(payRules.normal_hours_per_day)));
          setWeekday(String(payRules.weekday_extra_pct));
          setHoliday(String(payRules.holiday_extra_pct));
          setHolidayAll(payRules.holiday_all_hours);
          setSunday(payRules.sunday_as_holiday);
          setTravel(String(Number(payRules.travel_day_hours)));
          setNightStart(payRules.night_start.slice(0, 5));
          setNightEnd(payRules.night_end.slice(0, 5));
        }}
        onSubmit={(e) => {
          e.preventDefault();
          save(
            () =>
              createClient().rpc("roster_save_pay_rules", {
                p_data: {
                  shift_hours: Number(shift),
                  normal_hours_per_day: normal,
                  weekday_extra_pct: Number(weekday),
                  holiday_extra_pct: Number(holiday),
                  holiday_all_hours: holidayAll,
                  sunday_as_holiday: sunday,
                  travel_day_hours: travel,
                  night_start: nightStart,
                  night_end: nightEnd,
                },
              }),
            "Reglas guardadas"
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Horas del turno</label>
            <input type="number" min={4} max={16} step={1} value={shift} onChange={(e) => setShift(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Horas normales por día</label>
            <input type="number" min={1} max={24} step={0.5} value={normal} onChange={(e) => setNormal(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Recargo día hábil (%)</label>
            <input type="number" min={0} max={300} step={1} value={weekday} onChange={(e) => setWeekday(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Recargo feriado (%)</label>
            <input type="number" min={0} max={300} step={1} value={holiday} onChange={(e) => setHoliday(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Horas del día de viaje</label>
            <input type="number" min={0} max={24} step={0.5} value={travel} onChange={(e) => setTravel(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nocturno desde</label>
            <input type="time" value={nightStart} onChange={(e) => setNightStart(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nocturno hasta</label>
            <input type="time" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} required className={inputClass} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={holidayAll} onChange={(e) => setHolidayAll(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          En un feriado, todas las horas trabajadas van al recargo de feriado
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={sunday} onChange={(e) => setSunday(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Tratar los domingos como feriados
        </label>
        <p className="text-xs text-slate-500">
          Un día de trabajo de {shift || "?"} horas se reparte en hasta {normal || "?"} normales y el resto con recargo de día hábil. Se aplica al confirmar días como planificados y cuando dejás las horas en «auto». El horario nocturno es informativo: las horas nocturnas se cargan a mano o según el turno.
        </p>
      </FormShell>
    </Section>
  );
}

// ---------------------------------------------------------------- feriados
function HolidaysSection({ sites, holidays, year }: { sites: RosterSite[]; holidays: RosterHoliday[]; year: number }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | null | undefined>(undefined); // undefined: cerrado, null: nuevo, id: edición
  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? "-";

  async function remove(h: RosterHoliday) {
    const ok = await confirm({
      title: "¿Quitar el feriado?",
      description: `${h.name} (${formatSqlDate(h.day)}). Las horas ya guardadas no cambian, pero el día deja de figurar como feriado (también en períodos cerrados) y los días nuevos no lo tratan como tal.`,
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await createClient().rpc("roster_delete_holiday", { p_id: h.id });
    if (error) return notify.error("No se pudo quitar", error.message);
    notify.success("Feriado quitado");
    router.refresh();
  }

  const done = () => {
    setEditing(undefined);
    router.refresh();
  };
  const years = [year - 1, year, year + 1];

  return (
    <Section
      title="Feriados"
      description="Los días feriados se marcan en el calendario y cambian cómo se reparten las horas. Cargalos por año (nacionales, provinciales o de un sitio)."
      onNew={() => setEditing(null)}
      newLabel="Nuevo feriado"
    >
      <div className="mb-3 flex gap-1" role="group" aria-label="Año">
        {years.map((y) => (
          <Button key={y} variant={y === year ? "primary" : "secondary"} size="sm" onClick={() => router.push(`/roster/configuracion?anio=${y}`)}>
            {y}
          </Button>
        ))}
      </div>
      {editing === null && <HolidayForm sites={sites} defaultYear={year} onDone={done} onCancel={() => setEditing(undefined)} />}
      {holidays.length === 0 && editing === undefined && <EmptyState size="sm" title={`No hay feriados cargados en ${year}.`} description="Se cargan a mano, uno por uno." />}
      <ul className="divide-y divide-slate-100">
        {holidays.map((h) => (
          <li key={h.id} className="py-3 first:pt-0 last:pb-0">
            {editing === h.id ? (
              <HolidayForm sites={sites} holiday={h} defaultYear={year} onDone={done} onCancel={() => setEditing(undefined)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    <span className="tabular-nums">{formatSqlDate(h.day)}</span> · {h.name}{" "}
                    {!h.active && (
                      <Badge tone="muted" size="sm">
                        Inactivo
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {SCOPE_LABELS[h.scope] ?? h.scope}
                    {h.site_id ? ` · ${siteName(h.site_id)}` : ""}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="link" size="sm" onClick={() => setEditing(h.id)}>
                    Editar
                  </Button>
                  <Button variant="link-danger" size="sm" onClick={() => remove(h)}>
                    Quitar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HolidayForm({ sites, holiday, defaultYear, onDone, onCancel }: { sites: RosterSite[]; holiday?: RosterHoliday; defaultYear: number; onDone: () => void; onCancel: () => void }) {
  const [day, setDay] = useState(holiday?.day ?? `${defaultYear}-01-01`);
  const [name, setName] = useState(holiday?.name ?? "");
  const [scope, setScope] = useState(holiday?.scope ?? "nacional");
  const [siteId, setSiteId] = useState(holiday?.site_id ?? sites[0]?.id ?? "");
  const [active, setActive] = useState(holiday?.active ?? true);
  const { busy, error, save } = useSave(onDone);
  return (
    <FormShell
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            createClient().rpc("roster_save_holiday", {
              p_id: holiday?.id ?? (null as unknown as string),
              p_day: day,
              p_name: name,
              p_scope: scope,
              p_site_id: scope === "sitio" ? siteId : undefined,
              p_active: active,
            }),
          "Feriado guardado"
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Alcance</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {scope === "sitio" && (
          <div>
            <label className={labelClass}>Sitio</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required className={inputClass}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {holiday && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Activo
        </label>
      )}
    </FormShell>
  );
}

// ---------------------------------------------------------------- precios por hora
type RateGroup = { key: string; title: string; subtitle: string; rows: RosterRateRow[] };

function RatesSection({ rates, categories, options }: { rates: RosterRateRow[]; categories: string[]; options: RosterEmployeeOption[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, RateGroup>();
    for (const r of rates) {
      const key = r.employee_id ? `p:${r.employee_id}` : `c:${(r.job_category ?? "").toLowerCase()}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          title: r.employee_id ? employeeLabel({ last_name: r.last_name ?? "", first_name: r.first_name ?? "" }) : (r.job_category ?? ""),
          subtitle: r.employee_id ? `Persona${r.legajo ? ` · legajo ${r.legajo}` : ""}` : "Categoría",
          rows: [],
        };
        map.set(key, g);
      }
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => (a.key[0] === b.key[0] ? a.title.localeCompare(b.title, "es") : a.key[0] === "c" ? -1 : 1));
  }, [rates]);

  async function remove(r: RosterRateRow, title: string) {
    const ok = await confirm({
      title: "¿Quitar la tarifa vigente?",
      description: `${title}: ${formatMoney(r.hourly_rate, r.currency)} desde el ${formatSqlDate(r.valid_from)}. Si había una anterior, vuelve a regir. Queda registrado.`,
      confirmLabel: "Quitar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await createClient().rpc("roster_delete_rate", { p_id: r.id });
    if (error) return notify.error("No se pudo quitar", error.message);
    notify.success("Tarifa quitada");
    router.refresh();
  }

  return (
    <Section
      title="Precios por hora"
      description="Por categoría del empleado o por persona (la de la persona pisa a la de su categoría). Una tarifa nueva «desde» una fecha cierra la anterior el día previo: el historial no se pisa. Los ven y editan quienes tienen el módulo Roster."
      onNew={() => setCreating(true)}
      newLabel="Nueva tarifa"
    >
      {creating && (
        <RateForm
          categories={categories}
          options={options}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {groups.length === 0 && !creating && <EmptyState size="sm" title="Todavía no hay precios por hora." description="Sin tarifa, la pestaña Horas muestra las horas pero no el costo." />}
      <ul className="divide-y divide-slate-100">
        {groups.map((g) => (
          <li key={g.key} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-slate-900">
              {g.title} <span className="text-xs font-normal text-slate-500">· {g.subtitle}</span>
            </p>
            <ul className="mt-1 space-y-0.5">
              {g.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="tabular-nums">
                    <span className="font-medium text-slate-800">{formatMoney(r.hourly_rate, r.currency)}</span> por hora · desde {formatSqlDate(r.valid_from)}
                    {r.valid_to ? ` hasta ${formatSqlDate(r.valid_to)}` : " · vigente"}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                  {!r.valid_to && (
                    <Button variant="link-danger" size="sm" onClick={() => remove(r, g.title)}>
                      Quitar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RateForm({ categories, options, onDone, onCancel }: { categories: string[]; options: RosterEmployeeOption[]; onDone: () => void; onCancel: () => void }) {
  const [target, setTarget] = useState<"categoria" | "persona">("categoria");
  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { busy, error, save } = useSave(onDone);
  return (
    <FormShell
      busy={busy}
      error={localError ?? error}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (target === "persona" && !employeeId) return setLocalError("Elegí a la persona");
        // "1.234,56" → 1234.56; "1234.56" se respeta.
        const amount = Number(rate.includes(",") ? rate.replace(/\./g, "").replace(",", ".") : rate);
        if (!Number.isFinite(amount) || amount <= 0) return setLocalError("El precio por hora no es un número válido");
        setLocalError(null);
        save(
          () =>
            createClient().rpc("roster_save_rate", {
              p_employee_id: (target === "persona" ? employeeId : null) as unknown as string,
              p_job_category: (target === "categoria" ? category.replace(/\s+/g, " ").trim() : null) as unknown as string,
              p_rate: amount,
              p_currency: currency,
              p_from: from,
              p_note: note,
            }),
          "Tarifa guardada"
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Es una tarifa de</label>
          <select value={target} onChange={(e) => setTarget(e.target.value as "categoria" | "persona")} className={inputClass}>
            <option value="categoria">Una categoría</option>
            <option value="persona">Una persona</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          {target === "categoria" ? (
            <>
              <label className={labelClass}>Categoría</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} list="roster-categorias" required maxLength={120} placeholder="Tal como figura en Personal (si no coincide, no se aplica a nadie)" className={inputClass} />
              <datalist id="roster-categorias">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          ) : (
            <>
              <label className={labelClass}>Persona</label>
              <EmployeePicker options={options} selected={employeeId ? [employeeId] : []} onChange={(ids) => setEmployeeId(ids[0] ?? "")} ariaLabel="Buscar persona" />
            </>
          )}
        </div>
        <div>
          <label className={labelClass}>Precio por hora</label>
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" required placeholder="0,00" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Vigente desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Nota (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
        </div>
      </div>
    </FormShell>
  );
}
