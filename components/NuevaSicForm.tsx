"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ItemsEditor, { EMPTY_ITEM, type ItemDraft } from "@/components/ItemsEditor";

type Plant = { id: string; name: string; prefix: string };
type Project = { id: string; name: string };

export default function NuevaSicForm({
  plants,
  projects,
  defaultPlantId,
  lockPlant,
}: {
  plants: Plant[];
  projects: Project[];
  defaultPlantId: string | null;
  lockPlant: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [plantId, setPlantId] = useState(defaultPlantId ?? plants[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payloadItems = items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      specs: it.specs || null,
      reference_link: it.referenceLink || null,
    }));

    const { data: sic, error: createError } = await supabase.rpc("create_sic", {
      p_subject: subject,
      p_project_id: projects.length > 0 ? projectId || null : null,
      p_needed_by_date: neededByDate,
      p_currency: currency,
      p_plant_id: plantId || null,
      p_items: payloadItems,
    });

    if (createError || !sic) {
      setError(createError?.message ?? "No se pudo crear la SIC");
      setLoading(false);
      return;
    }

    const { data: createdItems } = await supabase
      .from("sic_items")
      .select("id, position")
      .eq("sic_id", sic.id)
      .order("position", { ascending: true });

    if (createdItems) {
      for (let i = 0; i < items.length; i++) {
        const file = items[i].file;
        const itemRow = createdItems[i];
        if (!file || !itemRow) continue;
        const path = `${sic.id}/referencia/${itemRow.id}/${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("sic-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) continue;
        await supabase.rpc("attach_file", {
          p_sic_id: sic.id,
          p_file_type: "referencia",
          p_storage_path: path,
          p_file_name: file.name,
          p_item_id: itemRow.id,
        });
      }
    }

    router.push(`/sic/${sic.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">¿Es para Taller o para un Proyecto?</label>
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            disabled={lockPlant && !!defaultPlantId}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.prefix})
              </option>
            ))}
          </select>
        </div>
        {projects.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Proyecto</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Asunto / razón de la compra</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Ej: Repuestos para torno CNC"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">¿Para qué fecha lo necesitás?</label>
          <input
            type="date"
            value={neededByDate}
            onChange={(e) => setNeededByDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "ARS" | "USD")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Artículos solicitados</label>
        <div className="mt-2">
          <ItemsEditor items={items} onChange={setItems} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
