"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import EmployeePicker from "@/components/ui/EmployeePicker";
import { notify } from "@/lib/notify";
import { inputClass, labelClass } from "@/lib/ui";
import {
  POSITION_SHIFT_LABELS,
  SHIFT_LABELS,
  describePattern,
  employeeLabel,
  isIsoDate,
  suggestMirrorAnchor,
  todayIso,
  type RosterAssignment,
  type RosterCrew,
  type RosterEmployeeOption,
  type RosterPattern,
  type RosterPosition,
  type RosterSite,
} from "@/lib/roster";

export type AssignmentFormMode = "single" | "crew" | "change";

// Alta de una asignación (individual o de una cuadrilla entera) y cambio desde una fecha.
// Un "cambio" termina la asignación el día anterior y abre otra: el calendario pasado no se modifica.
export default function AssignmentForm({
  mode,
  sites,
  patterns,
  positions,
  crews,
  options,
  assignments,
  current,
  defaultSiteId,
  onDone,
  onCancel,
}: {
  mode: AssignmentFormMode;
  sites: RosterSite[];
  patterns: RosterPattern[];
  positions: RosterPosition[];
  crews: RosterCrew[];
  options: RosterEmployeeOption[];
  assignments: RosterAssignment[];
  current?: RosterAssignment;
  defaultSiteId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const changing = mode === "change" && !!current;
  const activeSites = sites.filter((s) => s.active);
  const activePatterns = patterns.filter((p) => p.active || p.id === current?.pattern_id);

  // Si el sitio tiene una sola cuadrilla activa, se propone por defecto (evita cargar gente "Sin cuadrilla" por descuido).
  const defaultCrewFor = (site: string) => {
    const active = crews.filter((c) => c.site_id === site && c.active);
    return active.length === 1 ? active[0].id : "";
  };

  const [employeeId, setEmployeeId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [siteId, setSiteId] = useState(current?.site_id ?? defaultSiteId ?? activeSites[0]?.id ?? "");
  const [positionId, setPositionId] = useState(current?.position_id ?? "");
  const [crewId, setCrewId] = useState(current ? (current.crew_id ?? "") : defaultCrewFor(defaultSiteId ?? activeSites[0]?.id ?? ""));
  const [patternId, setPatternId] = useState(current?.pattern_id ?? activePatterns[0]?.id ?? "");
  const [shift, setShift] = useState<string>(current?.shift ?? "dia");
  const [alternate, setAlternate] = useState(current?.alternate_shift ?? false);
  const [anchor, setAnchor] = useState(changing ? current.anchor_date : "");
  const [anchorTouched, setAnchorTouched] = useState(false);
  const [from, setFrom] = useState(changing ? "" : todayIso());
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sitePositions = positions.filter((p) => p.site_id === siteId && (p.active || p.id === current?.position_id));
  const siteCrews = crews.filter((c) => c.site_id === siteId && (c.active || c.id === current?.crew_id));
  const pattern = patterns.find((p) => p.id === patternId);

  // Cuadrillas del sitio que ya tienen gente asignada: sirven de referencia para espejar.
  const references = useMemo(() => {
    const seen = new Map<string, RosterAssignment>();
    for (const a of assignments) {
      if (a.site_id === siteId && a.crew_id && !seen.has(a.crew_id) && (!a.valid_to || a.valid_to >= todayIso())) seen.set(a.crew_id, a);
    }
    return [...seen.values()];
  }, [assignments, siteId]);

  function mirrorFrom(refCrewId: string) {
    const ref = references.find((r) => r.crew_id === refCrewId);
    if (!ref) return;
    const refPattern = patterns.find((p) => p.id === ref.pattern_id);
    if (!refPattern) return;
    setPatternId(refPattern.id);
    setAnchor(suggestMirrorAnchor(ref.anchor_date, refPattern));
    setAnchorTouched(true);
    setShift(ref.shift);
    setAlternate(ref.alternate_shift);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "single" && !employeeId) return setError("Elegí a la persona");
    if (mode === "crew" && picked.length === 0) return setError("Elegí al menos una persona");
    if (!isIsoDate(from)) return setError(changing ? "Indicá desde qué fecha rige el cambio" : "Indicá la fecha de inicio");
    if (anchor && !isIsoDate(anchor)) return setError("La fecha ancla no es válida");

    setBusy(true);
    const supabase = createClient();

    if (changing) {
      const data: Record<string, string | boolean> = {};
      if (siteId !== current.site_id) data.site_id = siteId;
      if (positionId !== (current.position_id ?? "")) data.position_id = positionId;
      if (crewId !== (current.crew_id ?? "")) data.crew_id = crewId;
      if (patternId !== current.pattern_id) data.pattern_id = patternId;
      if (shift !== current.shift) data.shift = shift;
      if (alternate !== current.alternate_shift) data.alternate_shift = alternate;
      if (anchorTouched && anchor && anchor !== current.anchor_date) data.anchor_date = anchor;
      if (Object.keys(data).length === 0) {
        setBusy(false);
        return setError("No cambiaste nada");
      }
      const { error: err } = await supabase.rpc("roster_change_assignment", { p_id: current.id, p_effective_from: from, p_data: data });
      setBusy(false);
      if (err) return setError(err.message);
      notify.success("Cambio registrado");
    } else {
      const data = {
        site_id: siteId,
        position_id: positionId,
        crew_id: crewId,
        pattern_id: patternId,
        anchor_date: anchor || from,
        shift,
        alternate_shift: alternate,
        valid_from: from,
        valid_to: to,
      };
      if (mode === "single") {
        const { error: err } = await supabase.rpc("roster_create_assignment", { p_data: { ...data, employee_id: employeeId } });
        setBusy(false);
        if (err) return setError(err.message);
        notify.success("Asignación creada");
      } else {
        const { data: n, error: err } = await supabase.rpc("roster_assign_crew", { p_data: data, p_employee_ids: picked });
        setBusy(false);
        if (err) return setError(err.message);
        notify.success(n === 1 ? "1 persona asignada" : `${n} personas asignadas`);
      }
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      {changing && (
        <p className="text-sm text-slate-600">
          {employeeLabel(current)}: la asignación actual termina el día anterior a la fecha del cambio y empieza otra con los datos nuevos.
        </p>
      )}

      {mode === "single" && (
        <div>
          <label className={labelClass}>Persona</label>
          <EmployeePicker options={options} selected={employeeId ? [employeeId] : []} onChange={(ids) => setEmployeeId(ids[0] ?? "")} ariaLabel="Buscar persona" />
          {options.length === 0 && <p className="mt-1 text-xs text-slate-500">No hay empleados activos: cargalos en el módulo Personal.</p>}
        </div>
      )}

      {mode === "crew" && (
        <div>
          <label className={labelClass}>Personas de la cuadrilla ({picked.length} elegidas)</label>
          <EmployeePicker options={options} selected={picked} onChange={setPicked} multiple ariaLabel="Buscar personas" />
          {options.length === 0 && <p className="mt-1 text-xs text-slate-500">No hay empleados activos: cargalos en el módulo Personal.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Sitio</label>
          <select
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setPositionId("");
              setCrewId(defaultCrewFor(e.target.value));
            }}
            required
            className={inputClass}
          >
            {activeSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Puesto (opcional)</label>
          <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={inputClass}>
            <option value="">Sin puesto</option>
            {sitePositions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {POSITION_SHIFT_LABELS[p.shift] ?? p.shift}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cuadrilla (opcional)</label>
          <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={inputClass}>
            <option value="">Sin cuadrilla</option>
            {siteCrews.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {references.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <label className={labelClass}>Espejar a otra cuadrilla (opcional)</label>
          <select defaultValue="" onChange={(e) => e.target.value && mirrorFrom(e.target.value)} className={inputClass}>
            <option value="">Elegí la cuadrilla de referencia…</option>
            {references.map((r) => (
              <option key={r.crew_id!} value={r.crew_id!}>
                {r.crew_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Copia el régimen y el turno, y sugiere una fecha ancla para que esta cuadrilla suba cuando termina la otra: así siempre hay una en sitio.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>Régimen</label>
          <select
            value={patternId}
            onChange={(e) => {
              setPatternId(e.target.value);
              if (changing) setAnchorTouched(false);
            }}
            required
            className={inputClass}
          >
            {activePatterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {pattern && <p className="mt-1 text-xs text-slate-500">{describePattern(pattern)}</p>}
        </div>
        <div>
          <label className={labelClass}>Turno</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className={inputClass}>
            {Object.entries(SHIFT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={alternate} onChange={(e) => setAlternate(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        El turno alterna en cada ciclo (día, noche, día…)
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{changing ? "Rige desde" : "Vigente desde"}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required className={inputClass} />
        </div>
        {!changing && (
          <div>
            <label className={labelClass}>Vigente hasta (opcional)</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <label className={labelClass}>Fecha ancla (primer día del ciclo)</label>
          <input
            type="date"
            value={anchor}
            onChange={(e) => {
              setAnchor(e.target.value);
              setAnchorTouched(true);
            }}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            {changing ? "Si no la tocás, se mantiene (o arranca en la fecha del cambio si cambiás el régimen)." : "Si la dejás vacía, es la fecha de inicio."}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          {changing ? "Registrar cambio" : mode === "crew" ? "Asignar cuadrilla" : "Crear asignación"}
        </Button>
      </div>
    </form>
  );
}
