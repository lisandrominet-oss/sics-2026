"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { notify } from "@/lib/notify";
import { inputClass, labelClass } from "@/lib/ui";
import {
  POSITION_SHIFT_LABELS,
  describePattern,
  type RosterCrew,
  type RosterPattern,
  type RosterPosition,
  type RosterSite,
} from "@/lib/roster";

type Editing = { kind: "site" | "pattern" | "position" | "crew"; id: string | null } | null;

// Sitios, regímenes, puestos con dotación requerida y cuadrillas. Cada alta o edición va por una RPC de la base.
export default function RosterConfig({
  sites,
  patterns,
  positions,
  crews,
}: {
  sites: RosterSite[];
  patterns: RosterPattern[];
  positions: RosterPosition[];
  crews: RosterCrew[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "-";
  const activeSites = sites.filter((s) => s.active);

  function done() {
    setEditing(null);
    router.refresh();
  }
  const isEditing = (kind: NonNullable<Editing>["kind"], id: string | null) => editing?.kind === kind && editing.id === id;

  return (
    <div className="space-y-6">
      <Section
        title="Sitios"
        description="Minas, plantas u obras donde rota el personal."
        onNew={() => setEditing({ kind: "site", id: null })}
        newLabel="Nuevo sitio"
      >
        {isEditing("site", null) && <SiteForm onDone={done} onCancel={() => setEditing(null)} />}
        {sites.length === 0 && !editing && <EmptyState size="sm" title="Todavía no hay sitios." description="Creá el primero para poder armar el roster." />}
        <ul className="divide-y divide-slate-100">
          {sites.map((s) => (
            <li key={s.id} className="py-3 first:pt-0 last:pb-0">
              {isEditing("site", s.id) ? (
                <SiteForm site={s} onDone={done} onCancel={() => setEditing(null)} />
              ) : (
                <Row
                  title={s.name}
                  subtitle={s.code ? `Código ${s.code}` : undefined}
                  inactive={!s.active}
                  onEdit={() => setEditing({ kind: "site", id: s.id })}
                />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Regímenes de rotación"
        description="Días de trabajo y de franco, y cómo se cuentan los días de viaje (según el convenio). Un régimen en uso no cambia sus días: se crea otro."
        onNew={() => setEditing({ kind: "pattern", id: null })}
        newLabel="Nuevo régimen"
      >
        {isEditing("pattern", null) && <PatternForm onDone={done} onCancel={() => setEditing(null)} />}
        {patterns.length === 0 && !editing && <EmptyState size="sm" title="Todavía no hay regímenes." description="Por ejemplo 14x14 o 7x7." />}
        <ul className="divide-y divide-slate-100">
          {patterns.map((p) => (
            <li key={p.id} className="py-3 first:pt-0 last:pb-0">
              {isEditing("pattern", p.id) ? (
                <PatternForm pattern={p} onDone={done} onCancel={() => setEditing(null)} />
              ) : (
                <Row title={p.name} subtitle={describePattern(p)} inactive={!p.active} onEdit={() => setEditing({ kind: "pattern", id: p.id })} />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Puestos y dotación requerida"
        description="Cuántas personas tienen que estar trabajando a la vez en cada puesto y turno de un sitio."
        onNew={() => setEditing({ kind: "position", id: null })}
        newLabel="Nuevo puesto"
        disabled={activeSites.length === 0}
      >
        {isEditing("position", null) && <PositionForm sites={activeSites} onDone={done} onCancel={() => setEditing(null)} />}
        {positions.length === 0 && !editing && <EmptyState size="sm" title="Todavía no hay puestos." description="Se usan para asignar personas y, más adelante, para controlar la cobertura." />}
        <ul className="divide-y divide-slate-100">
          {positions.map((p) => (
            <li key={p.id} className="py-3 first:pt-0 last:pb-0">
              {isEditing("position", p.id) ? (
                <PositionForm sites={sites} position={p} onDone={done} onCancel={() => setEditing(null)} />
              ) : (
                <Row
                  title={p.name}
                  subtitle={`${siteName(p.site_id)} · turno ${POSITION_SHIFT_LABELS[p.shift] ?? p.shift} · requeridos: ${p.required_count}`}
                  inactive={!p.active}
                  onEdit={() => setEditing({ kind: "position", id: p.id })}
                />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Cuadrillas"
        description="Agrupan personas de un sitio para asignarlas juntas y verlas agrupadas en el calendario."
        onNew={() => setEditing({ kind: "crew", id: null })}
        newLabel="Nueva cuadrilla"
        disabled={activeSites.length === 0}
      >
        {isEditing("crew", null) && <CrewForm sites={activeSites} onDone={done} onCancel={() => setEditing(null)} />}
        {crews.length === 0 && !editing && <EmptyState size="sm" title="Todavía no hay cuadrillas." description="Por ejemplo «Cuadrilla A» y «Cuadrilla B» para rotar espejadas." />}
        <ul className="divide-y divide-slate-100">
          {crews.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              {isEditing("crew", c.id) ? (
                <CrewForm sites={sites} crew={c} onDone={done} onCancel={() => setEditing(null)} />
              ) : (
                <Row title={c.name} subtitle={siteName(c.site_id)} inactive={!c.active} onEdit={() => setEditing({ kind: "crew", id: c.id })} />
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function Section({
  title,
  description,
  onNew,
  newLabel,
  disabled,
  children,
}: {
  title: string;
  description: string;
  onNew?: () => void;
  newLabel?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 max-w-xl text-pretty text-xs text-slate-500">{description}</p>
        </div>
        {onNew && (
          <Button variant="secondary" size="sm" onClick={onNew} disabled={disabled} title={disabled ? "Primero creá un sitio" : undefined}>
            {newLabel}
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

export function Row({ title, subtitle, inactive, onEdit }: { title: string; subtitle?: string; inactive: boolean; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
          {title} {inactive && <Badge tone="muted" size="sm">Inactivo</Badge>}
        </p>
        {subtitle && <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">{subtitle}</p>}
      </div>
      <Button variant="link" size="sm" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

export function FormShell({
  onSubmit,
  onCancel,
  busy,
  error,
  children,
}: {
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {children}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

export function ActiveCheck({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
      Activo
    </label>
  );
}

// Corre una RPC y devuelve el mensaje de error (o null si salió bien).
export function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(call: () => PromiseLike<{ error: { message: string } | null }>, okMessage: string) {
    setBusy(true);
    setError(null);
    const { error: err } = await call();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    notify.success(okMessage);
    onDone();
  }
  return { busy, error, save };
}

function SiteForm({ site, onDone, onCancel }: { site?: RosterSite; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(site?.name ?? "");
  const [code, setCode] = useState(site?.code ?? "");
  const [active, setActive] = useState(site?.active ?? true);
  const { busy, error, save } = useSave(onDone);
  return (
    <FormShell
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        save(() => createClient().rpc("roster_save_site", { p_id: site?.id ?? null, p_name: name, p_code: code, p_active: active }), "Sitio guardado");
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Código (opcional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} className={inputClass} />
        </div>
      </div>
      {site && <ActiveCheck value={active} onChange={setActive} />}
    </FormShell>
  );
}

function PatternForm({ pattern, onDone, onCancel }: { pattern?: RosterPattern; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(pattern?.name ?? "");
  const [work, setWork] = useState(String(pattern?.work_days ?? 14));
  const [rest, setRest] = useState(String(pattern?.rest_days ?? 14));
  const [tin, setTin] = useState(String(pattern?.travel_in_days ?? 0));
  const [tout, setTout] = useState(String(pattern?.travel_out_days ?? 0));
  const [inside, setInside] = useState(pattern?.travel_inside_cycle ?? true);
  const [active, setActive] = useState(pattern?.active ?? true);
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
            createClient().rpc("roster_save_pattern", {
              p_id: pattern?.id ?? null,
              p_name: name,
              p_work_days: Number(work),
              p_rest_days: Number(rest),
              p_travel_in_days: Number(tin),
              p_travel_out_days: Number(tout),
              p_travel_inside_cycle: inside,
              p_active: active,
            }),
          "Régimen guardado"
        );
      }}
    >
      <div>
        <label className={labelClass}>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Ej. 14x14" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Días de trabajo</label>
          <input type="number" min={1} max={60} value={work} onChange={(e) => setWork(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Días de franco</label>
          <input type="number" min={0} max={60} value={rest} onChange={(e) => setRest(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Viaje de subida (días)</label>
          <input type="number" min={0} max={3} value={tin} onChange={(e) => setTin(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Viaje de bajada (días)</label>
          <input type="number" min={0} max={3} value={tout} onChange={(e) => setTout(e.target.value)} required className={inputClass} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={inside} onChange={(e) => setInside(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span>
          Los días de viaje están dentro del bloque de trabajo
          <span className="block text-xs text-slate-500">
            Si no, se suman antes y después de los días de trabajo y alargan el ciclo (depende del convenio).
          </span>
        </span>
      </label>
      {pattern && <ActiveCheck value={active} onChange={setActive} />}
    </FormShell>
  );
}

function PositionForm({ sites, position, onDone, onCancel }: { sites: RosterSite[]; position?: RosterPosition; onDone: () => void; onCancel: () => void }) {
  const [siteId, setSiteId] = useState(position?.site_id ?? sites[0]?.id ?? "");
  const [name, setName] = useState(position?.name ?? "");
  const [shift, setShift] = useState(position?.shift ?? "cualquiera");
  const [required, setRequired] = useState(String(position?.required_count ?? 1));
  const [active, setActive] = useState(position?.active ?? true);
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
            createClient().rpc("roster_save_position", {
              p_id: position?.id ?? null,
              p_site_id: siteId,
              p_name: name,
              p_shift: shift,
              p_required_count: Number(required),
              p_active: active,
            }),
          "Puesto guardado"
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Sitio</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required disabled={!!position} className={inputClass}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className={labelClass}>Puesto</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ej. Electricista" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Turno</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className={inputClass}>
            {Object.entries(POSITION_SHIFT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Personas requeridas</label>
          <input type="number" min={0} max={500} value={required} onChange={(e) => setRequired(e.target.value)} required className={inputClass} />
        </div>
      </div>
      {position && <ActiveCheck value={active} onChange={setActive} />}
    </FormShell>
  );
}

function CrewForm({ sites, crew, onDone, onCancel }: { sites: RosterSite[]; crew?: RosterCrew; onDone: () => void; onCancel: () => void }) {
  const [siteId, setSiteId] = useState(crew?.site_id ?? sites[0]?.id ?? "");
  const [name, setName] = useState(crew?.name ?? "");
  const [active, setActive] = useState(crew?.active ?? true);
  const { busy, error, save } = useSave(onDone);
  return (
    <FormShell
      busy={busy}
      error={error}
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        save(() => createClient().rpc("roster_save_crew", { p_id: crew?.id ?? null, p_site_id: siteId, p_name: name, p_active: active }), "Cuadrilla guardada");
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Sitio</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required disabled={!!crew} className={inputClass}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Ej. Cuadrilla A" className={inputClass} />
        </div>
      </div>
      {crew && <ActiveCheck value={active} onChange={setActive} />}
    </FormShell>
  );
}
