"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { filterClass } from "@/lib/ui";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { parseOverrides } from "@/lib/modules";
import { REMITO_ROLE_LABELS, untyped, type RemitoProject, type RemitoRole } from "@/lib/remitos";
import type { Json } from "@/lib/database.types";

export type StaffProfile = { id: string; full_name: string | null; email: string | null; role: UserRole | null; active: boolean; module_overrides: Json | null };
export type StaffRow = { user_id: string; role: RemitoRole; project_id: string | null; active: boolean };

const ROLES = Object.keys(REMITO_ROLE_LABELS) as RemitoRole[];

export default function RemitoStaffManager({ profiles, staff, projects }: { profiles: StaffProfile[]; staff: StaffRow[]; projects: RemitoProject[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const supabase = useMemo(() => untyped(createClient()), []);
  const byUser = useMemo(() => new Map(staff.map((s) => [s.user_id, s])), [staff]);
  const [draft, setDraft] = useState<Record<string, { role: RemitoRole | ""; project: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function current(p: StaffProfile) {
    const s = byUser.get(p.id);
    return draft[p.id] ?? { role: (s?.role ?? "") as RemitoRole | "", project: s?.project_id ?? "" };
  }

  async function remove(p: StaffProfile) {
    if (!(await confirm({
      title: "Quitar el rol en Remitos",
      description: `${p.full_name ?? p.email ?? "La persona"} deja de tener acceso al módulo. Lo que hizo queda en el historial.`,
      confirmLabel: "Quitar rol",
      destructive: true,
    }))) return;
    setBusy(p.id);
    const { error } = await supabase.rpc("remito_remove_staff", { p_user_id: p.id });
    setBusy(null);
    if (error) return notify.error("No se pudo quitar el rol", error.message);
    notify.success("Rol quitado");
    router.refresh();
  }

  async function save(p: StaffProfile, active = true) {
    const d = current(p);
    if (!d.role) return notify.error("Elegí un rol");
    setBusy(p.id);
    const { error } = await supabase.rpc("remito_set_staff", {
      p_user_id: p.id, p_role: d.role, p_project_id: d.role === "panol_proyecto" ? d.project || null : null, p_active: active,
    });
    setBusy(null);
    if (error) return notify.error("No se pudo guardar", error.message);
    notify.success(active ? "Rol guardado" : "Rol desactivado");
    setDraft((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    router.refresh();
  }

  return (
    <Card padding="none" className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">Usuario</th>
            <th className="px-4 py-3 font-medium">Rol en SICS</th>
            <th className="px-4 py-3 font-medium">Módulo</th>
            <th className="px-4 py-3 font-medium">Rol en Remitos</th>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const d = current(p);
            const s = byUser.get(p.id);
            const hasModule = p.role === "admin" || parseOverrides(p.module_overrides).remitos === true;
            return (
              <tr key={p.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  {p.full_name ?? "—"}
                  <span className="block text-xs text-slate-500">{p.email}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.role ? ROLE_LABELS[p.role] : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={hasModule ? "success" : "muted"} dot>{hasModule ? "Habilitado" : "Sin habilitar"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Rol en Remitos de ${p.full_name ?? p.email ?? "usuario"}`}
                    value={d.role}
                    onChange={(e) => setDraft({ ...draft, [p.id]: { role: e.target.value as RemitoRole | "", project: d.project } })}
                    className={filterClass}
                  >
                    <option value="">{p.role === "admin" ? "Administrador (siempre)" : "Sin rol"}</option>
                    {ROLES.map((r) => <option key={r} value={r}>{REMITO_ROLE_LABELS[r]}</option>)}
                  </select>
                  {s && !s.active && <span className="mt-1 block text-xs text-slate-500">Desactivado: sin acceso</span>}
                </td>
                <td className="px-4 py-3">
                  {d.role === "panol_proyecto" ? (
                    <select
                      aria-label="Proyecto"
                      value={d.project}
                      onChange={(e) => setDraft({ ...draft, [p.id]: { role: d.role, project: e.target.value } })}
                      className={filterClass}
                    >
                      <option value="">Elegir proyecto</option>
                      {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.code} · {pr.name}</option>)}
                    </select>
                  ) : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    <Button variant="link" size="sm" loading={busy === p.id} disabled={!d.role} onClick={() => save(p, true)}>Guardar</Button>
                    {s && p.role !== "admin" && <Button variant="link-danger" size="sm" disabled={busy === p.id} onClick={() => remove(p)}>Quitar rol</Button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Para asignar un rol la persona tiene que tener «Módulo: Habilitado» (se activa en Usuarios → Módulos). Sin rol no entra al módulo. El jefe de área que supervisa va con «Administración» (solo mira). El administrador de SICS siempre es administrador de Remitos.
      </p>
    </Card>
  );
}
