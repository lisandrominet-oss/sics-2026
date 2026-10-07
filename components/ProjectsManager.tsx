"use client";

import { inputClass, labelClass } from "@/lib/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import Button from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function ProjectsManager({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").insert({ name });
    setLoading(false);
    if (error) {
      notify.error("No se pudo crear el proyecto", error.message);
      return;
    }
    setName("");
    notify.success("Proyecto creado");
    router.refresh();
  }

  async function toggleActive(project: Project) {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ active: !project.active }).eq("id", project.id);
    reportResult(error, project.active ? "Proyecto archivado" : "Proyecto reactivado");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-x-auto">
        <table className="tabla-fija-1 w-full min-w-[420px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-slate-700">{p.name}</td>
                <td className="px-4 py-3">{p.active ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                    {p.active ? "Desactivar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay proyectos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <form onSubmit={addProject} className={cardClass({ className: "space-y-3" })}>
        <h2 className="text-sm font-semibold text-slate-900">Agregar proyecto</h2>
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej: Ampliación planta 2"
            className={inputClass}
          />
        </div>
        <Button type="submit" loading={loading}>
          Agregar
        </Button>
      </form>
    </div>
  );
}
