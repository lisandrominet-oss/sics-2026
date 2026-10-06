"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/EmptyState";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  ROLES_REQUIRING_PLANT,
  ROLE_LABELS,
  STAFF_ASSIGNABLE_ROLES,
  type UserRole,
} from "@/lib/constants";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Provisioned = Database["public"]["Tables"]["user_provisioning"]["Row"];
type Plant = { id: string; name: string; prefix: string };

const SELECT_CLASS = "rounded-md border border-slate-300 px-2 py-1 text-sm";

function needsPlant(role: UserRole | "") {
  return !!role && ROLES_REQUIRING_PLANT.includes(role);
}

export default function StaffUsersManager({
  users,
  pending,
  plants,
  currentUserId,
}: {
  users: Profile[];
  pending: Provisioned[];
  plants: Plant[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Usuarios de la empresa</h2>
          <p className="mt-1 text-xs text-slate-500">Los que ya iniciaron sesión.</p>
        </div>
        {users.length === 0 ? (
          <EmptyState title="No hay usuarios para mostrar" className="!border-0 py-8" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Activo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <UserRow key={u.id} user={u} plants={plants} isSelf={u.id === currentUserId} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Accesos pendientes</h2>
            <p className="mt-1 text-xs text-slate-500">
              Gente cargada antes de su primer ingreso: apenas entren con su cuenta de Google corporativa, tienen el
              rol y el área asignados.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {showForm ? "Cancelar" : "+ Añadir usuario"}
          </button>
        </div>

        {showForm && (
          <AddForm
            plants={plants}
            onDone={() => {
              setShowForm(false);
              notify.success("Usuario añadido");
              router.refresh();
            }}
          />
        )}

        {pending.length === 0 ? (
          <EmptyState title="No hay accesos pendientes" className="!border-0 py-8" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((entry) => (
              <PendingRow key={entry.id} entry={entry} plants={plants} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
  className = SELECT_CLASS,
}: {
  value: UserRole | "";
  onChange: (r: UserRole) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as UserRole)}
      className={`${className} disabled:bg-slate-50 disabled:text-slate-400`}
    >
      {value === "" && <option value="">Sin rol</option>}
      {STAFF_ASSIGNABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function PlantSelect({
  value,
  onChange,
  plants,
  className = SELECT_CLASS,
}: {
  value: string;
  onChange: (v: string) => void;
  plants: Plant[];
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">Sin área</option>
      {plants.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function UserRow({ user, plants, isSelf }: { user: Profile; plants: Plant[]; isSelf: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | "">(user.role ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [plantId, setPlantId] = useState(user.plant_id ?? "");
  const [active, setActive] = useState(user.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!role) {
      setError("Indicá el rol.");
      return;
    }
    if (needsPlant(role) && !plantId) {
      setError("Este rol necesita un área.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("staff_update_user", {
      p_profile_id: user.id,
      p_role: role,
      p_department: department,
      p_plant_id: plantId || (null as unknown as string),
      p_active: active,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    notify.success("Usuario actualizado");
    router.refresh();
  }

  return (
    <tr className={!user.active ? "bg-slate-50/70" : ""}>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">
          {user.full_name ?? "-"}
          {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(vos)</span>}
        </p>
        <p className="text-xs text-slate-400">{user.email}</p>
      </td>
      <td className="px-4 py-3">
        <RoleSelect value={role} onChange={setRole} disabled={isSelf} />
      </td>
      <td className="px-4 py-3">
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Ej: Jefe de Taller"
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <PlantSelect value={plantId} onChange={setPlantId} plants={plants} />
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          {active ? "Activo" : "Pausado"}
        </label>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Guardar
        </button>
        {error && <p role="alert" className="animate-shake mt-1 max-w-[12rem] text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function PendingRow({ entry, plants }: { entry: Provisioned; plants: Plant[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [fullName, setFullName] = useState(entry.full_name ?? "");
  const [role, setRole] = useState<UserRole>(entry.role);
  const [department, setDepartment] = useState(entry.department ?? "");
  const [plantId, setPlantId] = useState(entry.plant_id ?? "");
  const [active, setActive] = useState(entry.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (needsPlant(role) && !plantId) {
      setError("Este rol necesita un área.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("staff_update_user_access", {
      p_id: entry.id,
      p_full_name: fullName,
      p_role: role,
      p_department: department,
      p_plant_id: plantId || (null as unknown as string),
      p_active: active,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    notify.success("Acceso actualizado");
    router.refresh();
  }

  async function remove() {
    if (
      !(await confirm({
        title: `¿Eliminar el acceso pendiente de ${entry.full_name ?? entry.email}?`,
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
        destructive: true,
      }))
    )
      return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("staff_delete_user_access", { p_id: entry.id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    notify.success("Acceso pendiente eliminado");
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-4">
      <div className="min-w-[10rem] flex-1">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre"
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-900"
        />
        <p className="mt-0.5 text-xs text-slate-500">{entry.email}</p>
      </div>
      <RoleSelect value={role} onChange={(r) => setRole(r)} />
      <input
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        placeholder="Cargo"
        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <PlantSelect value={plantId} onChange={setPlantId} plants={plants} />
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activo
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Guardar
      </button>
      <button onClick={remove} className="text-xs font-medium text-red-600 hover:underline">
        Eliminar
      </button>
      {error && <p role="alert" className="animate-shake w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}

function AddForm({ plants, onDone }: { plants: Plant[]; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("operativo");
  const [department, setDepartment] = useState("");
  const [plantId, setPlantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needsPlant(role) && !plantId) {
      setError("Los jefes de área, operativos y pañoleros necesitan un área asignada.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("staff_add_user_access", {
      p_email: email,
      p_full_name: fullName,
      p_role: role,
      p_department: department,
      p_plant_id: plantId || (null as unknown as string),
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-b border-slate-100 bg-slate-50 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Nombre</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Cuenta de Google corporativa</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nombre@ser-ind.com.ar"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Rol</label>
          <RoleSelect value={role} onChange={setRole} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Cargo</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Ej: Jefe de Taller"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Área</label>
          <PlantSelect value={plantId} onChange={setPlantId} plants={plants} className={inputClass} />
        </div>
      </div>
      {error && <p role="alert" className="animate-shake text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
