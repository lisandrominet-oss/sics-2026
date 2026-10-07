"use client";

import { inputClass } from "@/lib/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import type { Database } from "@/lib/database.types";

type Plant = Database["public"]["Tables"]["plants"]["Row"];

export default function PlantsManager({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPlant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("plants").insert({
      name,
      prefix: prefix.toUpperCase(),
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setPrefix("");
    notify.success("Planta creada");
    router.refresh();
  }

  async function toggleActive(plant: Plant) {
    const supabase = createClient();
    const { error } = await supabase.from("plants").update({ active: !plant.active }).eq("id", plant.id);
    reportResult(error, plant.active ? "Planta archivada" : "Planta reactivada");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="tabla-fija-1 w-full min-w-[480px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Prefijo</th>
              <th className="px-4 py-3">Activa</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plants.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-slate-700">{p.name}</td>
                <td className="px-4 py-3 font-mono text-slate-700">{p.prefix}</td>
                <td className="px-4 py-3">{p.active ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(p)}
                    className="text-xs font-medium text-slate-600 underline"
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={addPlant} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Agregar planta</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Prefijo</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              required
              placeholder="Ej: TAMET"
              className={inputClass}
            />
          </div>
        </div>
        {error && <p role="alert" className="animate-shake text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Agregar
        </button>
      </form>
    </div>
  );
}
