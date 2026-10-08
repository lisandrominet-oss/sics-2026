"use client";

import { inputClass, labelClass } from "@/lib/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import Button from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";
import type { Database } from "@/lib/database.types";

type Plant = Database["public"]["Tables"]["plants"]["Row"];

export default function PlantsManager({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);

  async function addPlant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("plants").insert({
      name,
      prefix: prefix.toUpperCase(),
    });
    setLoading(false);
    if (error) {
      notify.error("No se pudo crear la planta", error.message);
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
      <Card padding="none" className="overflow-x-auto">
        <table className="tabla-fija-1 w-full min-w-[480px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Prefijo</th>
              <th className="px-4 py-3 font-medium">Activa</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plants.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-slate-700">{p.name}</td>
                <td className="px-4 py-3 font-mono text-slate-700">{p.prefix}</td>
                <td className="px-4 py-3">{p.active ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                    {p.active ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <form onSubmit={addPlant} className={cardClass({ className: "space-y-3" })}>
        <h2 className="text-sm font-semibold text-slate-900">Agregar planta</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Prefijo</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              required
              placeholder="Ej: TAMET"
              className={inputClass}
            />
          </div>
        </div>
        <Button type="submit" loading={loading}>
          Agregar
        </Button>
      </form>
    </div>
  );
}
