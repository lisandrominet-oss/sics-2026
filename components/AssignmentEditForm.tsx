"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { inputClass, labelClass } from "@/lib/ui";
import { employeeLabel, type RosterAssignment, type RosterCrew, type RosterPosition } from "@/lib/roster";

// Cambia solo el puesto y la cuadrilla de una asignación (no altera el calendario calculado).
export default function AssignmentEditForm({
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
