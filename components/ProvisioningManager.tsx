"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

type Provisioned = Database["public"]["Tables"]["user_provisioning"]["Row"];
type Plant = { id: string; name: string; prefix: string };

const ROLES: UserRole[] = ["area", "compras", "gerencia", "panol", "admin"];

export default function ProvisioningManager({
  entries,
  plants,
}: {
  entries: Provisioned[];
  plants: Plant[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Accesos</p>
          <h2 className="text-base font-semibold text-slate-900">
            Usuarios habilitados (todavía sin iniciar sesión)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cargá acá a la gente antes de que inicie sesión: apenas entren con esa cuenta de Google
            corporativa, van a tener el rol y el cargo asignados automáticamente.
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
            router.refresh();
          }}
        />
      )}

      {entries.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-400">
          No hay usuarios pre-cargados todavía.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <ProvisionedRow key={entry.id} entry={entry} plants={plants} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddForm({ plants, onDone }: { plants: Plant[]; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("area");
  const [department, setDepartment] = useState("");
  const [plantId, setPlantId] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("user_provisioning").insert({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim() || null,
      role,
      department: department.trim() || null,
      plant_id: plantId || null,
      active,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-b border-slate-100 bg-slate-50 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Nombre</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Cuenta de Gmail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="nombre@ser-ind.com.ar"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Departamento / Cargo</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Ej: Jefe de Mantenimiento"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Planta por defecto</label>
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Sin definir</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activo (si está desmarcado, va a quedar pausado apenas inicie sesión)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
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

function ProvisionedRow({ entry, plants }: { entry: Provisioned; plants: Plant[] }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(entry.role);
  const [department, setDepartment] = useState(entry.department ?? "");
  const [plantId, setPlantId] = useState(entry.plant_id ?? "");
  const [active, setActive] = useState(entry.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("user_provisioning")
      .update({ role, department: department || null, plant_id: plantId || null, active })
      .eq("id", entry.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`¿Eliminar el acceso pre-cargado de ${entry.full_name ?? entry.email}?`)) return;
    const supabase = createClient();
    await supabase.from("user_provisioning").delete().eq("id", entry.id);
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-4">
      <div className="min-w-[10rem] flex-1">
        <p className="text-sm font-semibold text-slate-900">{entry.full_name ?? "-"}</p>
        <p className="text-xs text-slate-500">{entry.email}</p>
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <input
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        placeholder="Departamento"
        className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <select
        value={plantId}
        onChange={(e) => setPlantId(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="">Sin planta</option>
        {plants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
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
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </li>
  );
}
