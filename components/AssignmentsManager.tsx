"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import AssignmentForm, { type AssignmentFormMode } from "@/components/AssignmentForm";
import { notify } from "@/lib/notify";
import { formatSqlDate } from "@/lib/constants";
import { inputClass, labelClass } from "@/lib/ui";
import {
  SHIFT_LABELS,
  employeeLabel,
  todayIso,
  type RosterAssignment,
  type RosterCrew,
  type RosterEmployeeOption,
  type RosterPattern,
  type RosterPosition,
  type RosterSite,
  type Shift,
} from "@/lib/roster";

type ModalState =
  | { type: "form"; mode: AssignmentFormMode; assignment?: RosterAssignment }
  | { type: "end"; assignment: RosterAssignment }
  | { type: "edit"; assignment: RosterAssignment }
  | null;

export default function AssignmentsManager({
  sites,
  patterns,
  positions,
  crews,
  options,
  assignments,
  showHistory,
}: {
  sites: RosterSite[];
  patterns: RosterPattern[];
  positions: RosterPosition[];
  crews: RosterCrew[];
  options: RosterEmployeeOption[];
  assignments: RosterAssignment[];
  showHistory: boolean;
}) {
  const [siteFilter, setSiteFilter] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  // El último modal mostrado se conserva mientras dura la animación de salida.
  const [lastModal, setLastModal] = useState<ModalState>(null);
  const shown = modal ?? lastModal;
  const today = todayIso();
  const router = useRouter();
  const confirm = useConfirm();

  // Una asignación que todavía no empezó y se cargó por error se anula (queda en la auditoría).
  async function voidAssignment(a: RosterAssignment) {
    const ok = await confirm({
      title: "¿Anular la asignación?",
      description: `${employeeLabel(a)} en ${a.site_name}, desde el ${formatSqlDate(a.valid_from)}. Todavía no empezó: se quita del roster y queda registrado.`,
      confirmLabel: "Anular",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await createClient().rpc("roster_void_assignment", { p_id: a.id });
    if (error) return notify.error("No se pudo anular", error.message);
    notify.success("Asignación anulada");
    router.refresh();
  }

  function open(m: ModalState) {
    setModal(m);
    setLastModal(m);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (siteFilter && a.site_id !== siteFilter) return false;
      if (!q) return true;
      return `${a.last_name} ${a.first_name} ${a.legajo ?? ""} ${a.position_name ?? ""} ${a.crew_name ?? ""}`.toLowerCase().includes(q);
    });
  }, [assignments, siteFilter, query]);

  const noBase = sites.filter((s) => s.active).length === 0 || patterns.filter((p) => p.active).length === 0;

  return (
    <div className="space-y-6">
      {noBase && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Para asignar personas hace falta al menos un sitio y un régimen activos.{" "}
          <Link href="/roster/configuracion" className="font-medium underline">
            Ir a Configuración
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar persona, puesto o cuadrilla"
            aria-label="Buscar asignaciones"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72"
          />
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            aria-label="Filtrar por sitio"
            className="w-full max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
          >
            <option value="">Todos los sitios</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Link href={showHistory ? "/roster/asignaciones" : "/roster/asignaciones?historial=1"} className={buttonClass({ variant: "ghost", size: "sm" })}>
            {showHistory ? "Ocultar terminadas" : "Ver también las terminadas"}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={noBase} onClick={() => open({ type: "form", mode: "crew" })}>
            Asignar cuadrilla
          </Button>
          <Button disabled={noBase} onClick={() => open({ type: "form", mode: "single" })}>
            Nueva asignación
          </Button>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No hay asignaciones para mostrar"
            description="Asigná personas a un sitio con un régimen y una fecha de inicio del ciclo para que aparezcan en el calendario."
            className="!border-0"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((a) => {
              const left = a.employee_status === "baja";
              const ended = (!!a.valid_to && a.valid_to < today) || left;
              const upcoming = a.valid_from > today;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1 basis-[14rem]">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {employeeLabel(a)} {a.employee_status === "licencia" && <Badge tone="warning" size="sm">En licencia</Badge>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {a.site_name}
                      {a.position_name ? ` · ${a.position_name}` : ""}
                      {a.crew_name ? ` · ${a.crew_name}` : ""}
                    </p>
                  </div>
                  <div className="text-xs tabular-nums text-slate-500">
                    <p>
                      {a.pattern_name} · turno {SHIFT_LABELS[a.shift as Shift] ?? a.shift}
                      {a.alternate_shift ? " (alterna)" : ""}
                    </p>
                    <p>
                      {formatSqlDate(a.valid_from)} → {a.valid_to ? formatSqlDate(a.valid_to) : "sin fin"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {left ? <Badge tone="muted">Empleado de baja</Badge> : ended ? <Badge tone="muted">Terminada</Badge> : upcoming ? <Badge tone="info">Futura</Badge> : <Badge tone="success">Vigente</Badge>}
                    {!ended && (
                      <>
                        <Button variant="link" size="sm" onClick={() => open({ type: "edit", assignment: a })}>
                          Puesto/cuadrilla
                        </Button>
                        <Button variant="link" size="sm" onClick={() => open({ type: "form", mode: "change", assignment: a })}>
                          Cambiar desde…
                        </Button>
                        {upcoming ? (
                          <Button variant="link-danger" size="sm" onClick={() => voidAssignment(a)}>
                            Anular
                          </Button>
                        ) : (
                          <Button variant="link-danger" size="sm" onClick={() => open({ type: "end", assignment: a })}>
                            Terminar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={modal?.type === "form"}
        onClose={() => setModal(null)}
        title={shown?.type === "form" ? (shown.mode === "single" ? "Nueva asignación" : shown.mode === "crew" ? "Asignar cuadrilla" : "Cambiar desde una fecha") : ""}
        className="sm:max-w-2xl"
      >
        {shown?.type === "form" && (
          <AssignmentForm
            key={`${shown.mode}-${shown.assignment?.id ?? "nuevo"}`}
            mode={shown.mode}
            sites={sites}
            patterns={patterns}
            positions={positions}
            crews={crews}
            options={options}
            assignments={assignments}
            current={shown.assignment}
            defaultSiteId={siteFilter || undefined}
            onDone={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal?.type === "end"} onClose={() => setModal(null)} title="Terminar asignación">
        {shown?.type === "end" && <EndForm key={shown.assignment.id} assignment={shown.assignment} onDone={() => setModal(null)} onCancel={() => setModal(null)} />}
      </Modal>

      <Modal open={modal?.type === "edit"} onClose={() => setModal(null)} title="Puesto y cuadrilla">
        {shown?.type === "edit" && (
          <EditForm
            key={shown.assignment.id}
            assignment={shown.assignment}
            positions={positions}
            crews={crews}
            onDone={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function EndForm({ assignment, onDone, onCancel }: { assignment: RosterAssignment; onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [to, setTo] = useState(todayIso() > assignment.valid_from ? todayIso() : assignment.valid_from);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("roster_update_assignment", { p_id: assignment.id, p_data: { valid_to: to } });
    setBusy(false);
    if (err) return setError(err.message);
    notify.success("Asignación terminada");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-sm text-slate-600">
        {employeeLabel(assignment)} deja de figurar en el calendario de {assignment.site_name} después de la fecha de fin. No se borra nada: queda en el historial.
      </p>
      <div>
        <label className={labelClass}>Último día en el roster</label>
        <input type="date" value={to} min={assignment.valid_from} onChange={(e) => setTo(e.target.value)} required className={inputClass} />
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
        <Button type="submit" variant="danger" loading={busy}>
          Terminar
        </Button>
      </div>
    </form>
  );
}

function EditForm({
  assignment,
  positions,
  crews,
  onDone,
  onCancel,
}: {
  assignment: RosterAssignment;
  positions: RosterPosition[];
  crews: RosterCrew[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [positionId, setPositionId] = useState(assignment.position_id ?? "");
  const [crewId, setCrewId] = useState(assignment.crew_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sitePositions = positions.filter((p) => p.site_id === assignment.site_id && (p.active || p.id === assignment.position_id));
  const siteCrews = crews.filter((c) => c.site_id === assignment.site_id && (c.active || c.id === assignment.crew_id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("roster_update_assignment", { p_id: assignment.id, p_data: { position_id: positionId, crew_id: crewId } });
    setBusy(false);
    if (err) return setError(err.message);
    notify.success("Asignación actualizada");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-sm text-slate-600">
        {employeeLabel(assignment)} · {assignment.site_name}. Estos cambios no alteran el calendario; para cambiar el régimen, la fecha ancla o el turno usá «Cambiar desde…».
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Puesto</label>
          <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className={inputClass}>
            <option value="">Sin puesto</option>
            {sitePositions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cuadrilla</label>
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
          Guardar
        </Button>
      </div>
    </form>
  );
}
