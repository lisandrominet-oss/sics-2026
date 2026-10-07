"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import Button from "@/components/ui/Button";
import { inputCompactClass } from "@/lib/ui";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Plant = { id: string; name: string; prefix: string };

const ROLES: UserRole[] = ["operativo", "area", "compras", "gerencia", "panol", "admin"];

export default function UsersTable({
  profiles,
  plants,
  currentUserId,
}: {
  profiles: Profile[];
  plants: Plant[];
  currentUserId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="tabla-fija-1 w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Departamento</th>
            <th className="px-4 py-3">Planta</th>
            <th className="px-4 py-3">Activo</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {profiles.map((p) => (
            <UserRow key={p.id} profile={p} plants={plants} isSelf={p.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  profile,
  plants,
  isSelf,
}: {
  profile: Profile;
  plants: Plant[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | "">(profile.role ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [plantId, setPlantId] = useState(profile.plant_id ?? "");
  const [active, setActive] = useState(profile.active);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        role: role || null,
        department: department || null,
        plant_id: plantId || null,
        active,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      notify.error("No se pudo guardar el usuario", error.message);
      return;
    }
    notify.success("Usuario actualizado");
    router.refresh();
  }

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{profile.full_name ?? "-"}</p>
        <p className="text-xs text-slate-400">{profile.email}</p>
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={inputCompactClass}
        >
          <option value="">Sin rol</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Ej: Mantenimiento"
          className={`w-36 ${inputCompactClass}`}
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={plantId}
          onChange={(e) => setPlantId(e.target.value)}
          className={inputCompactClass}
        >
          <option value="">-</option>
          {plants.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.prefix}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={active}
          disabled={isSelf}
          onChange={(e) => setActive(e.target.checked)}
        />
      </td>
      <td className="px-4 py-3">
        <Button size="sm" onClick={save} loading={saving}>
          Guardar
        </Button>
      </td>
    </tr>
  );
}
