"use client";

import { inputClass } from "@/lib/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify, reportResult } from "@/lib/notify";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function ProjectsManager({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("projects").insert({ name });
    setLoading(false);
    if (error) {
      setError(error.message);
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                  <button
                    onClick={() => toggleActive(p)}
                    className="text-xs font-medium text-slate-600 underline"
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
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
      </div>

      <form onSubmit={addProject} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Agregar proyecto</h2>
        <div>
          <label className="block text-xs font-medium text-slate-700">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej: Ampliación planta 2"
            className={inputClass}
          />
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
