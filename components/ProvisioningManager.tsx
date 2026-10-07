"use client";

import { inputClass, inputCompactClass, labelClass } from "@/lib/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import type { Database } from "@/lib/database.types";

type Provisioned = Database["public"]["Tables"]["user_provisioning"]["Row"];
type Plant = { id: string; name: string; prefix: string };

const ROLES: UserRole[] = ["operativo", "area", "compras", "gerencia", "panol", "admin"];

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
    <Card padding="none">
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
        <Button onClick={() => setShowForm((v) => !v)} className="shrink-0">
          {showForm ? "Cancelar" : "+ Añadir usuario"}
        </Button>
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
    </Card>
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
    setError(null);
    if ((role === "area" || role === "operativo" || role === "panol") && !plantId) {
      setError("Los jefes de área, los operativos y los pañoleros necesitan un área (planta) asignada.");
      return;
    }
    setLoading(true);
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Cuenta de Gmail</label>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Departamento / Cargo</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Ej: Jefe de Mantenimiento"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Planta por defecto</label>
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className={inputClass}
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
      {error && <p role="alert" className="animate-shake text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={loading}>
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function ProvisionedRow({ entry, plants }: { entry: Provisioned; plants: Plant[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [role, setRole] = useState<UserRole>(entry.role);
  const [department, setDepartment] = useState(entry.department ?? "");
  const [plantId, setPlantId] = useState(entry.plant_id ?? "");
  const [active, setActive] = useState(entry.active);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("user_provisioning")
      .update({ role, department: department || null, plant_id: plantId || null, active })
      .eq("id", entry.id);
    setSaving(false);
    if (error) {
      notify.error("No se pudo guardar el acceso", error.message);
      return;
    }
    notify.success("Acceso actualizado");
    router.refresh();
  }

  async function remove() {
    if (
      !(await confirm({
        title: `¿Eliminar el acceso pre-cargado de ${entry.full_name ?? entry.email}?`,
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
        destructive: true,
      }))
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("user_provisioning").delete().eq("id", entry.id);
    reportResult(error, "Acceso pre-cargado eliminado");
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
        className={inputCompactClass}
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
        className={`w-40 ${inputCompactClass}`}
      />
      <select
        value={plantId}
        onChange={(e) => setPlantId(e.target.value)}
        className={inputCompactClass}
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
      <Button size="sm" onClick={save} loading={saving}>
        Guardar
      </Button>
      <Button variant="link-danger" size="sm" onClick={remove}>
        Eliminar
      </Button>
    </li>
  );
}
