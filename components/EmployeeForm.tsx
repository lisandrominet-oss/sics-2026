"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { notify } from "@/lib/notify";
import { dniCuilError, digitsOnly, type Employee } from "@/lib/employees";
import { inputClass, labelClass } from "@/lib/ui";

type Plant = { id: string; name: string; prefix: string; active: boolean };

// Alta y edición del legajo base. Con `employee` edita; sin él crea y va a la ficha.
export default function EmployeeForm({
  plants,
  suggestions,
  employee,
  onDone,
  onCancel,
}: {
  plants: Plant[];
  suggestions: { positions: string[]; categories: string[] };
  employee?: Employee;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [lastName, setLastName] = useState(employee?.last_name ?? "");
  const [firstName, setFirstName] = useState(employee?.first_name ?? "");
  const [dni, setDni] = useState(employee?.dni ?? "");
  const [cuil, setCuil] = useState(employee?.cuil ?? "");
  const [legajo, setLegajo] = useState(employee?.legajo ?? "");
  const [birthDate, setBirthDate] = useState(employee?.birth_date ?? "");
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [jobCategory, setJobCategory] = useState(employee?.job_category ?? "");
  const [plantId, setPlantId] = useState(employee?.plant_id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las áreas dadas de baja no se ofrecen, salvo la que el empleado ya tiene.
  const plantOptions = plants.filter((p) => p.active || p.id === employee?.plant_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const idError = dniCuilError(dni, cuil);
    if (idError) {
      setError(idError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const payload = {
      legajo,
      last_name: lastName,
      first_name: firstName,
      dni: digitsOnly(dni),
      cuil: digitsOnly(cuil),
      birth_date: birthDate,
      hire_date: hireDate,
      position,
      job_category: jobCategory,
      plant_id: plantId,
    };

    if (employee) {
      const { error: updateError } = await supabase.rpc("update_employee", { p_id: employee.id, p_data: payload });
      setLoading(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      notify.success("Datos actualizados");
      router.refresh();
      onDone?.();
      return;
    }

    const { data, error: createError } = await supabase.rpc("create_employee", { p_data: payload });
    if (createError || !data) {
      setError(createError?.message ?? "No se pudo crear el empleado");
      setLoading(false);
      return;
    }
    notify.success("Empleado creado");
    router.push(`/personal/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass({ padding: "lg", className: "space-y-4" })}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Apellido</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={120} autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Nombre</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={120} autoComplete="off" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>DNI</label>
          <input value={dni} onChange={(e) => setDni(e.target.value)} required inputMode="numeric" autoComplete="off" placeholder="Solo números" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>CUIL (opcional)</label>
          <input value={cuil} onChange={(e) => setCuil(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Con o sin guiones" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Legajo (opcional)</label>
          <input value={legajo} onChange={(e) => setLegajo(e.target.value)} maxLength={40} autoComplete="off" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Fecha de nacimiento (opcional)</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha de ingreso (opcional)</label>
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Puesto (opcional)</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} list="personal-puestos" maxLength={120} autoComplete="off" className={inputClass} />
          <datalist id="personal-puestos">
            {suggestions.positions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelClass}>Categoría (opcional)</label>
          <input value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} list="personal-categorias" maxLength={120} autoComplete="off" className={inputClass} />
          <datalist id="personal-categorias">
            {suggestions.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelClass}>Área (opcional)</label>
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className={inputClass}>
            <option value="">Sin área</option>
            {plantOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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

      <div className="flex justify-end gap-2 pt-2">
        {(onCancel || !employee) && (
          <Button variant="secondary" onClick={onCancel ?? (() => router.push("/personal"))} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {employee ? "Guardar cambios" : "Crear empleado"}
        </Button>
      </div>
    </form>
  );
}
