"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PromptDialog from "@/components/ui/PromptDialog";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { notify } from "@/lib/notify";
import { formatSqlDate } from "@/lib/constants";
import { inputClass, labelClass } from "@/lib/ui";
import { downloadRosterHoursXlsx, type RosterHoursExportRow } from "@/lib/exportRoster";
import { addDays, employeeLabel, formatHours, formatMoney, isIsoDate, monthBounds, type RosterClosure, type RosterCostRow, type RosterHoursRow, type RosterSite } from "@/lib/roster";

const COLUMNS: { key: keyof RosterHoursRow; label: string; title: string }[] = [
  { key: "days_worked", label: "Trab.", title: "Días trabajados (confirmados)" },
  { key: "days_travel", label: "Viaje", title: "Días de viaje (subida o bajada)" },
  { key: "days_vacation", label: "Vac.", title: "Días de vacaciones" },
  { key: "days_license", label: "Lic.", title: "Días de licencia" },
  { key: "days_sick", label: "Enf.", title: "Días de enfermedad o ART" },
  { key: "days_absent", label: "Aus.", title: "Días de ausencia o suspensión" },
  { key: "days_other", label: "Otros", title: "Bajadas anticipadas y subidas demoradas" },
  { key: "days_holiday_worked", label: "Fer.", title: "Feriados trabajados" },
  { key: "hours_normal", label: "H. norm.", title: "Horas normales" },
  { key: "hours_extra50", label: "Ex. 50%", title: "Horas extra al 50%" },
  { key: "hours_extra100", label: "Ex. 100%", title: "Horas extra al 100% (feriados)" },
  { key: "hours_night", label: "Noct.", title: "Horas nocturnas (incluidas en las trabajadas)" },
  { key: "hours_travel", label: "H. viaje", title: "Horas de viaje" },
  { key: "hours_total", label: "Total h", title: "Horas totales (normales + extra + viaje)" },
];

const nf = (v: unknown, key: keyof RosterHoursRow) => (key.startsWith("hours_") ? formatHours(Number(v)) : String(v));

// Resumen de horas y días CONFIRMADOS por persona en un período, con costo; cierre de período y export para liquidar.
export default function RosterHours({
  sites,
  siteId,
  from,
  to,
  today,
  rows,
  costs,
  closures,
}: {
  sites: RosterSite[];
  siteId: string;
  from: string;
  to: string;
  today: string;
  rows: RosterHoursRow[];
  costs: RosterCostRow[];
  closures: RosterClosure[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState<RosterClosure | null>(null);
  const [lastReopening, setLastReopening] = useState<RosterClosure | null>(null);
  const [busy, setBusy] = useState<"confirm" | "export" | null>(null);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);
  const reopenShown = reopening ?? lastReopening;
  const siteName = (id: string | null) => (id ? (sites.find((s) => s.id === id)?.name ?? "-") : "Todos los sitios");

  // Una persona puede tener varias filas de costo (una por moneda) y, aparte, los días con horas y sin tarifa (moneda nula).
  const costBy = useMemo(() => {
    const m = new Map<string, RosterCostRow[]>();
    for (const c of costs) m.set(c.employee_id, [...(m.get(c.employee_id) ?? []), c]);
    return m;
  }, [costs]);
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of COLUMNS) t[c.key] = rows.reduce((n, r) => n + Number(r[c.key] ?? 0), 0);
    t.unconfirmed = rows.reduce((n, r) => n + r.days_unconfirmed, 0);
    return t;
  }, [rows]);
  const costTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) if (c.currency) m.set(c.currency, (m.get(c.currency) ?? 0) + c.cost);
    return [...m.entries()];
  }, [costs]);
  const withoutRate = costs.reduce((n, c) => n + c.days_without_rate, 0);

  const openClosures = closures.filter((c) => !c.reopened_at);
  const coveredBy = openClosures.find((c) => c.date_from <= from && c.date_to >= to && (!c.site_id || c.site_id === siteId));

  function go(params: { sitio?: string; desde?: string; hasta?: string }) {
    const sp = new URLSearchParams();
    const sitio = params.sitio ?? siteId;
    if (sitio) sp.set("sitio", sitio);
    sp.set("desde", params.desde ?? from);
    sp.set("hasta", params.hasta ?? to);
    router.push(`/roster/horas?${sp.toString()}`);
  }

  function submitRange(e: FormEvent) {
    e.preventDefault();
    if (!isIsoDate(fromInput) || !isIsoDate(toInput)) return notify.error("Revisá las fechas");
    if (toInput < fromInput) return notify.error("La fecha final no puede ser anterior a la inicial");
    go({ desde: fromInput, hasta: toInput });
  }

  const thisMonth = monthBounds(today);
  const prevMonth = monthBounds(addDays(thisMonth.from, -1));
  const presets = [
    { label: "Mes actual", from: thisMonth.from, to: thisMonth.to },
    { label: "Mes anterior", from: prevMonth.from, to: prevMonth.to },
    { label: "1.ª quincena", from: thisMonth.from, to: `${thisMonth.from.slice(0, 8)}15` },
    { label: "2.ª quincena", from: `${thisMonth.from.slice(0, 8)}16`, to: thisMonth.to },
  ];

  async function confirmPending() {
    const upTo = to < today ? to : today;
    const ok = await confirm({
      title: "¿Confirmar el período como planificado?",
      description: `${totals.unconfirmed === 1 ? "El día sin confirmar" : `Los ${totals.unconfirmed} días sin confirmar`} hasta el ${formatSqlDate(upTo)} en ${siteName(siteId || null)} se registra${totals.unconfirmed === 1 ? "" : "n"} como estaba${totals.unconfirmed === 1 ? "" : "n"} planificado${totals.unconfirmed === 1 ? "" : "s"} (estado y horas según las reglas de pago). Queda registrado.`,
      confirmLabel: "Confirmar",
    });
    if (!ok) return;
    setBusy("confirm");
    const { data, error } = await createClient().rpc("roster_confirm_range", { p_from: from, p_to: upTo, p_site_id: siteId });
    setBusy(null);
    if (error) return notify.error("No se pudo confirmar", error.message);
    notify.success(data === 1 ? "1 día confirmado" : `${data} días confirmados`);
    router.refresh();
  }

  async function closePeriod(note: string) {
    const { error } = await createClient().rpc("roster_close_period", { p_from: from, p_to: to, p_site_id: siteId || undefined, p_note: note || undefined });
    if (error) {
      notify.error("No se pudo cerrar", error.message);
      return false;
    }
    notify.success("Período cerrado");
    router.refresh();
    return true;
  }

  async function reopen(c: RosterClosure, reason: string) {
    const { error } = await createClient().rpc("roster_reopen_period", { p_id: c.id, p_reason: reason });
    if (error) {
      notify.error("No se pudo reabrir", error.message);
      return false;
    }
    notify.success("Período reabierto");
    router.refresh();
    return true;
  }

  async function exportXlsx() {
    setBusy("export");
    try {
      const data: RosterHoursExportRow[] = rows.map((r) => {
        const priced = (costBy.get(r.employee_id) ?? []).filter((c) => c.currency);
        const missing = (costBy.get(r.employee_id) ?? []).reduce((n, c) => n + c.days_without_rate, 0);
        const single = priced.length === 1 ? priced[0] : null;
        return {
          legajo: r.legajo ?? "",
          apellido: r.last_name,
          nombre: r.first_name,
          sitios: r.site_names ?? "",
          cuadrilla: r.crew_name ?? "",
          diasTrabajados: r.days_worked,
          diasViaje: r.days_travel,
          diasFranco: r.days_rest,
          diasVacaciones: r.days_vacation,
          diasLicencia: r.days_license,
          diasEnfermedad: r.days_sick,
          diasAusencia: r.days_absent,
          diasOtros: r.days_other,
          feriadosTrabajados: r.days_holiday_worked,
          diasSinConfirmar: r.days_unconfirmed,
          horasNormales: r.hours_normal,
          horasExtra50: r.hours_extra50,
          horasExtra100: r.hours_extra100,
          horasNocturnas: r.hours_night,
          horasViaje: r.hours_travel,
          horasTotales: r.hours_total,
          precioHora: single?.rate ?? null,
          moneda: priced.map((c) => c.currency).join(" + "),
          costo: single ? single.cost : null,
          costoDetalle: priced.length > 1 ? priced.map((c) => formatMoney(c.cost, c.currency)).join(" + ") : "",
          diasSinTarifa: missing,
        };
      });
      await downloadRosterHoursXlsx(data, `roster-horas_${from}_${to}.xlsx`, true);
      notify.success("Archivo generado");
    } catch {
      notify.error("No se pudo generar el archivo");
    } finally {
      setBusy(null);
    }
  }

  const canClose = to < today && !coveredBy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form onSubmit={submitRange} className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass} htmlFor="horas-sitio">
              Sitio
            </label>
            <select id="horas-sitio" value={siteId} onChange={(e) => go({ sitio: e.target.value })} className={`${inputClass} !mt-1 sm:w-auto`}>
              <option value="">Todos los sitios</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="horas-desde">
              Desde
            </label>
            <input id="horas-desde" type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} className={`${inputClass} sm:w-auto`} />
          </div>
          <div>
            <label className={labelClass} htmlFor="horas-hasta">
              Hasta
            </label>
            <input id="horas-hasta" type="date" value={toInput} min={fromInput} onChange={(e) => setToInput(e.target.value)} className={`${inputClass} sm:w-auto`} />
          </div>
          <Button type="submit" variant="secondary">
            Ver
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-1">
          {presets.map((p) => (
            <Link key={p.label} href={`/roster/horas?${siteId ? `sitio=${siteId}&` : ""}desde=${p.from}&hasta=${p.to}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Del {formatSqlDate(from)} al {formatSqlDate(to)} · {siteName(siteId || null)} · máximo 62 días por vez.{" "}
          {coveredBy ? <Badge tone="muted">Período cerrado</Badge> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {totals.unconfirmed > 0 && (
            <Button
              variant="secondary"
              onClick={confirmPending}
              loading={busy === "confirm"}
              disabled={!siteId}
              title={siteId ? undefined : "Elegí un sitio para confirmar sus días"}
            >
              Confirmar {totals.unconfirmed} {totals.unconfirmed === 1 ? "día" : "días"} como planificado
            </Button>
          )}
          <Button variant="secondary" onClick={exportXlsx} loading={busy === "export"} disabled={rows.length === 0}>
            Exportar Excel
          </Button>
          <Button onClick={() => setClosing(true)} disabled={!canClose || rows.length === 0} title={coveredBy ? "Ya está cerrado" : to >= today ? "Solo se puede cerrar un período que ya terminó (hasta ayer)" : undefined}>
            Cerrar período
          </Button>
        </div>
      </div>

      {totals.unconfirmed > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hay {totals.unconfirmed} {totals.unconfirmed === 1 ? "día" : "días"} del período sin confirmar: no suma{totals.unconfirmed === 1 ? "" : "n"} horas ni costo hasta que lo{totals.unconfirmed === 1 ? "" : "s"} confirmes (en el calendario, día por día, o con el botón de arriba).
        </p>
      )}
      {withoutRate > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hay {withoutRate} {withoutRate === 1 ? "día" : "días"} con horas y sin precio por hora: cargalo en{" "}
          <Link href="/roster/configuracion" className="font-medium underline">
            Configuración
          </Link>{" "}
          (por persona o por categoría).
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No hay personas asignadas en el período" description="Cuando haya asignaciones que toquen estas fechas, acá aparece el resumen." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-sheet">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <caption className="sr-only">Horas y días confirmados por persona en el período</caption>
            <thead>
              <tr className="text-slate-500">
                <th scope="col" className="sticky left-0 z-10 min-w-[12rem] border-b border-slate-100 bg-sheet px-3 py-2 text-left font-medium">
                  Persona
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" title={c.title} className="border-b border-slate-100 px-2 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
                <th scope="col" title="Días que ya pasaron y no están confirmados" className="border-b border-slate-100 px-2 py-2 text-right font-medium">
                  Sin conf.
                </th>
                <th scope="col" className="border-b border-slate-100 px-2 py-2 text-right font-medium">
                  $/hora
                </th>
                <th scope="col" className="border-b border-slate-100 px-3 py-2 text-right font-medium">
                  Costo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const priced = (costBy.get(r.employee_id) ?? []).filter((c) => c.currency);
                const missing = (costBy.get(r.employee_id) ?? []).reduce((n, c) => n + c.days_without_rate, 0);
                return (
                  <tr key={r.employee_id} className="hover:bg-slate-50">
                    <th scope="row" className="sticky left-0 z-10 max-w-[16rem] border-t border-slate-100 bg-sheet px-3 py-1.5 text-left font-normal">
                      <p className="truncate text-xs font-medium text-slate-900">{employeeLabel(r)}</p>
                      <p className="truncate text-[10px] text-slate-400">{[r.legajo, r.crew_name].filter(Boolean).join(" · ")}</p>
                    </th>
                    {COLUMNS.map((col) => {
                      const v = Number(r[col.key] ?? 0);
                      return (
                        <td key={col.key} className={`border-t border-slate-100 px-2 py-1.5 text-right tabular-nums ${v === 0 ? "text-slate-300" : "text-slate-800"} ${col.key === "hours_total" ? "font-semibold" : ""}`}>
                          {nf(v, col.key)}
                        </td>
                      );
                    })}
                    <td className={`border-t border-slate-100 px-2 py-1.5 text-right tabular-nums ${r.days_unconfirmed > 0 ? "font-semibold text-amber-700" : "text-slate-300"}`}>{r.days_unconfirmed}</td>
                    <td className="border-t border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{priced.length > 0 ? priced.map((c) => <div key={c.currency}>{formatMoney(c.rate, c.currency)}</div>) : <span className="text-slate-300">-</span>}</td>
                    <td className="border-t border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-800">
                      {priced.length > 0 ? priced.map((c) => <div key={c.currency}>{formatMoney(c.cost, c.currency)}</div>) : <span className="text-slate-300">-</span>}
                      {missing > 0 && (
                        <span role="img" aria-label={`${missing} ${missing === 1 ? "día" : "días"} sin precio por hora`} className="ml-1 text-amber-600" title={`${missing} ${missing === 1 ? "día" : "días"} sin precio por hora`}>
                          ⚠
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-slate-900">
                <th scope="row" className="sticky left-0 z-10 border-t border-slate-200 bg-sheet px-3 py-2 text-left">
                  Total ({rows.length})
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="border-t border-slate-200 px-2 py-2 text-right tabular-nums">
                    {nf(totals[c.key], c.key)}
                  </td>
                ))}
                <td className="border-t border-slate-200 px-2 py-2 text-right tabular-nums">{totals.unconfirmed}</td>
                <td className="border-t border-slate-200" />
                <td className="border-t border-slate-200 px-3 py-2 text-right tabular-nums">
                  {costTotals.length === 0 ? "-" : costTotals.map(([cur, v]) => <div key={cur}>{formatMoney(v, cur)}</div>)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Solo cuentan los días confirmados. El costo = precio por hora × (horas normales + extra 50% × (1 + recargo hábil) + extra 100% × (1 + recargo de feriado) + horas de viaje), con los recargos de Configuración; no incluye adicionales (nocturnidad, viáticos). Los parámetros son editables y deben validarse con RRHH o el contador según el convenio.
      </p>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Períodos cerrados</h2>
        <p className="mt-0.5 text-xs text-slate-500">Un período cerrado no admite cambios de días, excepciones, asignaciones ni tarifas que lo toquen hasta reabrirlo (queda registrado con el motivo). Ojo: las reglas de pago y los feriados no se congelan; cambiarlos recalcula el costo de períodos cerrados (las horas guardadas no cambian).</p>
        {closures.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Todavía no se cerró ningún período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {closures.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums text-slate-900">
                    {formatSqlDate(c.date_from)} → {formatSqlDate(c.date_to)} <span className="font-normal text-slate-500">· {siteName(c.site_id)}</span>{" "}
                    {c.reopened_at && <Badge tone="muted" size="sm">Reabierto</Badge>}
                  </p>
                  {(c.note || c.reopen_reason) && <p className="text-xs text-slate-500">{[c.note, c.reopen_reason ? `Reapertura: ${c.reopen_reason}` : null].filter(Boolean).join(" · ")}</p>}
                </div>
                {!c.reopened_at && (
                  <Button
                    variant="link-danger"
                    size="sm"
                    onClick={() => {
                      setReopening(c);
                      setLastReopening(c);
                    }}
                  >
                    Reabrir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PromptDialog
        open={closing}
        onClose={() => setClosing(false)}
        title="Cerrar período"
        description={`Del ${formatSqlDate(from)} al ${formatSqlDate(to)} · ${siteName(siteId || null)}. Todos los días tienen que estar confirmados. Después no se podrán cambiar sin reabrirlo.`}
        fields={[{ name: "note", label: "Nota (opcional)", placeholder: "Ej.: liquidación de octubre" }]}
        confirmLabel="Cerrar período"
        onSubmit={(v) => closePeriod(v.note ?? "")}
      />
      <PromptDialog
        open={reopening !== null}
        onClose={() => setReopening(null)}
        title="Reabrir período"
        description={reopenShown ? `Del ${formatSqlDate(reopenShown.date_from)} al ${formatSqlDate(reopenShown.date_to)} · ${siteName(reopenShown.site_id)}. Queda registrado con el motivo.` : undefined}
        fields={[{ name: "reason", label: "Motivo", required: true, placeholder: "Ej.: corrección de horas de un día" }]}
        confirmLabel="Reabrir"
        destructive
        onSubmit={(v) => (reopenShown ? reopen(reopenShown, v.reason ?? "") : false)}
      />
    </div>
  );
}
