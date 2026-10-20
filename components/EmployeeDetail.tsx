"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import InfoItem from "@/components/ui/InfoItem";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import EmployeeForm from "@/components/EmployeeForm";
import { notify } from "@/lib/notify";
import { formatDateOnly } from "@/lib/contracts";
import { formatDate as formatEventDate } from "@/lib/constants";
import {
  EMPLOYEE_EVENT_LABELS,
  EMPLOYEE_FIELD_LABELS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONES,
  employeeName,
  formatCuil,
  formatDni,
  type EmployeeStatus,
  type EmployeeWithPlant,
} from "@/lib/employees";
import type { Json } from "@/lib/database.types";
import { inputClass, labelClass } from "@/lib/ui";

type Plant = { id: string; name: string; prefix: string; active: boolean };
type EmployeeEvent = {
  id: string;
  event_type: string;
  old_value: Json | null;
  new_value: Json | null;
  note: string | null;
  created_at: string;
  actor: { full_name: string | null } | null;
};

const DATE_FIELDS = new Set(["birth_date", "hire_date", "termination_date"]);

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EmployeeDetail({
  employee,
  events,
  plants,
  suggestions,
}: {
  employee: EmployeeWithPlant;
  events: EmployeeEvent[];
  plants: Plant[];
  suggestions: { positions: string[]; categories: string[] };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaDate, setBajaDate] = useState(todayIso());
  const [bajaNote, setBajaNote] = useState("");
  const [busy, setBusy] = useState(false);

  const status = employee.status as EmployeeStatus;
  const plantNames = new Map(plants.map((p) => [p.id, p.name]));

  async function setStatus(next: EmployeeStatus, date?: string, note?: string): Promise<boolean> {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_employee_status", {
      p_id: employee.id,
      p_status: next,
      ...(date ? { p_date: date } : {}),
      ...(note ? { p_note: note } : {}),
    });
    setBusy(false);
    if (error) {
      notify.error("No se pudo cambiar el estado", error.message);
      return false;
    }
    notify.success(next === "baja" ? "Baja registrada" : next === "licencia" ? "Licencia registrada" : "Empleado activo");
    router.refresh();
    return true;
  }

  async function startLicense() {
    const ok = await confirm({
      title: "¿Iniciar licencia?",
      description: `${employeeName(employee)} pasa a figurar en licencia hasta que la termines.`,
      confirmLabel: "Iniciar licencia",
    });
    if (ok) await setStatus("licencia");
  }

  async function endLicense() {
    const ok = await confirm({ title: "¿Terminar la licencia?", description: `${employeeName(employee)} vuelve a figurar como activo.`, confirmLabel: "Terminar licencia" });
    if (ok) await setStatus("activo");
  }

  async function reactivate() {
    const ok = await confirm({
      title: "¿Reactivar al empleado?",
      description: "Se borra la fecha de baja y vuelve a figurar como activo. Queda registrado en el historial.",
      confirmLabel: "Reactivar",
    });
    if (ok) await setStatus("activo");
  }

  async function submitBaja(e: React.FormEvent) {
    e.preventDefault();
    if (await setStatus("baja", bajaDate, bajaNote.trim())) {
      setBajaOpen(false);
      setBajaNote("");
    }
  }

  function describeValue(key: string, value: Json | undefined) {
    if (value === null || value === undefined || value === "") return "vacío";
    if (DATE_FIELDS.has(key) && typeof value === "string") return formatDateOnly(value);
    if (key === "plant_id" && typeof value === "string") return plantNames.get(value) ?? "otra área";
    if (key === "dni" && typeof value === "string") return formatDni(value);
    if (key === "cuil" && typeof value === "string") return formatCuil(value);
    if (key === "status" && typeof value === "string") return EMPLOYEE_STATUS_LABELS[value as EmployeeStatus] ?? value;
    return String(value);
  }

  function describeEvent(ev: EmployeeEvent): string[] {
    const oldV = (ev.old_value && typeof ev.old_value === "object" && !Array.isArray(ev.old_value) ? ev.old_value : {}) as Record<string, Json>;
    const newV = (ev.new_value && typeof ev.new_value === "object" && !Array.isArray(ev.new_value) ? ev.new_value : {}) as Record<string, Json>;
    if (ev.event_type === "edicion") {
      return Object.keys(newV).map(
        (k) => `${EMPLOYEE_FIELD_LABELS[k] ?? k}: ${describeValue(k, oldV[k])} → ${describeValue(k, newV[k])}`
      );
    }
    if (ev.event_type === "baja" && typeof newV.termination_date === "string") {
      return [`Fecha de baja: ${formatDateOnly(newV.termination_date)}`];
    }
    return [];
  }

  if (editing) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-slate-900">Editar a {employeeName(employee)}</h1>
        <EmployeeForm plants={plants} suggestions={suggestions} employee={employee} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere]">{employeeName(employee)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={EMPLOYEE_STATUS_TONES[status] ?? "neutral"} dot>
              {EMPLOYEE_STATUS_LABELS[status] ?? employee.status}
            </Badge>
            {employee.termination_date && <span className="text-sm text-slate-500">Baja el {formatDateOnly(employee.termination_date)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            Editar
          </Button>
          {status === "activo" && (
            <Button variant="secondary" onClick={startLicense} disabled={busy}>
              Iniciar licencia
            </Button>
          )}
          {status === "licencia" && (
            <Button variant="secondary" onClick={endLicense} disabled={busy}>
              Terminar licencia
            </Button>
          )}
          {status !== "baja" ? (
            <Button variant="danger-outline" onClick={() => setBajaOpen(true)} disabled={busy}>
              Dar de baja
            </Button>
          ) : (
            <Button onClick={reactivate} disabled={busy}>
              Reactivar
            </Button>
          )}
        </div>
      </div>

      <Card title="Datos del legajo">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem definition label="DNI" value={formatDni(employee.dni)} />
          <InfoItem definition label="CUIL" value={formatCuil(employee.cuil)} />
          <InfoItem definition label="Legajo" value={employee.legajo ?? "-"} />
          <InfoItem definition label="Fecha de nacimiento" value={employee.birth_date ? formatDateOnly(employee.birth_date) : "-"} />
          <InfoItem definition label="Fecha de ingreso" value={employee.hire_date ? formatDateOnly(employee.hire_date) : "-"} />
          <InfoItem definition label="Área" value={employee.plant ? `${employee.plant.name} (${employee.plant.prefix})` : "-"} />
          <InfoItem definition label="Puesto" value={employee.position ?? "-"} />
          <InfoItem definition label="Categoría" value={employee.job_category ?? "-"} />
        </dl>
      </Card>

      <Card title="Historial">
        {events.length === 0 ? (
          <EmptyState size="sm" title="Todavía no hay movimientos registrados." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((ev) => {
              const lines = describeEvent(ev);
              return (
                <li key={ev.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{EMPLOYEE_EVENT_LABELS[ev.event_type] ?? ev.event_type}</p>
                    <p className="text-xs tabular-nums text-slate-500">
                      {formatEventDate(ev.created_at)}
                      {ev.actor?.full_name ? ` · ${ev.actor.full_name}` : ""}
                    </p>
                  </div>
                  {lines.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {lines.map((l) => (
                        <li key={l} className="[overflow-wrap:anywhere]">
                          {l}
                        </li>
                      ))}
                    </ul>
                  )}
                  {ev.note && <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">{ev.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={bajaOpen} onClose={() => !busy && setBajaOpen(false)} title="Dar de baja">
        <form onSubmit={submitBaja} className="mt-3 space-y-4">
          <p className="text-sm text-slate-600">
            {employeeName(employee)} deja de figurar como activo. Los datos no se borran: queda en la pestaña Bajas y se puede reactivar.
          </p>
          <div>
            <label className={labelClass}>Fecha de baja</label>
            <input
              type="date"
              value={bajaDate}
              onChange={(e) => setBajaDate(e.target.value)}
              min={employee.hire_date ?? undefined}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Motivo (opcional)</label>
            <textarea value={bajaNote} onChange={(e) => setBajaNote(e.target.value)} rows={2} maxLength={500} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBajaOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Dar de baja
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
