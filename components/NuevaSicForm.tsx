"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ItemsEditor, { EMPTY_ITEM, type ItemDraft } from "@/components/ItemsEditor";
import { STATUS_LABELS, sanitizeFileName, type SicStatus } from "@/lib/constants";

type Plant = { id: string; name: string; prefix: string };
type Project = { id: string; name: string };

export default function NuevaSicForm({
  plants,
  projects,
  defaultPlantId,
  canPickPlant,
}: {
  plants: Plant[];
  projects: Project[];
  defaultPlantId: string | null;
  canPickPlant: boolean;
}) {
  const router = useRouter();
  // Si el usuario no tiene una planta asignada en su perfil, no hay nada a lo que
  // bloquearlo: mostramos el selector igual aunque su rol no sea compras/admin.
  const plantEditable = canPickPlant || !defaultPlantId;
  const [subject, setSubject] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [plantId, setPlantId] = useState(defaultPlantId ?? plants[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [onBehalfOf, setOnBehalfOf] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ id: string; code: string; status: SicStatus; description: string }[]>([]);

  // Aviso suave de posibles pedidos repetidos: busca SIC en curso de la misma área con un artículo parecido.
  const itemsKey = items.map((i) => i.description.trim().toLowerCase()).join("|");
  useEffect(() => {
    if (!plantId) {
      setSimilar([]);
      return;
    }
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const found = new Map<string, { id: string; code: string; status: SicStatus; description: string }>();
      for (const it of items.slice(0, 10)) {
        const tokens = it.description
          .split(/\s+/)
          .map((t) => t.replace(/[%,()_*]/g, ""))
          .filter((t) => t.length >= 3)
          .sort((a, b) => b.length - a.length)
          .slice(0, 2);
        if (it.description.trim().length < 4 || tokens.length === 0) continue;
        let q = supabase
          .from("sic_items")
          .select("description, sic:sics!inner(id, code, status, plant_id)")
          .eq("sic.plant_id", plantId)
          .not("sic.status", "in", "(anulada,rechazada_jefe,rechazada_compras,rechazada_gerencia,cerrada)");
        for (const t of tokens) q = q.ilike("description", `%${t}%`);
        const { data } = await q.limit(3);
        for (const row of (data ?? []) as unknown as { description: string; sic: { id: string; code: string; status: SicStatus } }[]) {
          if (row.sic) found.set(row.sic.id, { ...row.sic, description: row.description });
        }
      }
      setSimilar(Array.from(found.values()).slice(0, 5));
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, plantId]);

  const selectedPlantName = plants.find((p) => p.id === plantId);

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
      requires_quality_cert: it.requiresQualityCert,
    }));

    const { data: sic, error: createError } = await supabase.rpc("create_sic", {
      p_subject: subject,
      p_project_id: projectId || null,
      p_needed_by_date: neededByDate,
      // La moneda se define cuando Compras carga la cotización, no al pedirla.
      p_currency: "ARS",
      p_plant_id: plantId || null,
      p_items: payloadItems,
      p_on_behalf_of: canPickPlant ? onBehalfOf || null : null,
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

    const failedFiles: string[] = [];
    if (createdItems) {
      for (let i = 0; i < items.length; i++) {
        const file = items[i].file;
        const itemRow = createdItems[i];
        if (!file || !itemRow) continue;
        const path = `${sic.id}/referencia/${itemRow.id}/${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("sic-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) {
          failedFiles.push(file.name);
          continue;
        }
        const { error: attachErr } = await supabase.rpc("attach_file", {
          p_sic_id: sic.id,
          p_file_type: "referencia",
          p_storage_path: path,
          p_file_name: file.name,
          p_item_id: itemRow.id,
        });
        if (attachErr) failedFiles.push(file.name);
      }
    }

    // Si algún archivo no se pudo subir, no redirigimos en silencio: avisamos para que no se pierda.
    if (failedFiles.length > 0) {
      setCreatedId(sic.id);
      setError(
        `La SIC se creó, pero no se pudo subir: ${failedFiles.join(", ")}. Podés anularla y crearla de nuevo, o pedirle a Compras que te la devuelva para corregir.`
      );
      setLoading(false);
      return;
    }

    router.push(`/sic/${sic.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Área</label>
          {plantEditable ? (
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.prefix})
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {selectedPlantName ? `${selectedPlantName.name} (${selectedPlantName.prefix})` : "-"}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Seleccionar proyecto</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Taller</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canPickPlant && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Solicita:</label>
          <input
            value={onBehalfOf}
            onChange={(e) => setOnBehalfOf(e.target.value)}
            placeholder="Ej: Martín Vargas (no tiene acceso a su mail)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            Completalo solo si estás cargando esta SIC por un área que no puede ingresar con su propio mail.
          </p>
        </div>
      )}

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

      <div>
        <label className="block text-sm font-medium text-slate-700">Fecha límite</label>
        <input
          type="date"
          value={neededByDate}
          onChange={(e) => setNeededByDate(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Artículos solicitados</label>
        <div className="mt-2">
          <ItemsEditor items={items} onChange={setItems} />
        </div>
      </div>

      {similar.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Puede que ya exista un pedido parecido en tu área:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
            {similar.map((sic) => (
              <li key={sic.id}>
                <Link href={`/sic/${sic.id}`} target="_blank" className="font-semibold underline">
                  {sic.code}
                </Link>{" "}
                — {sic.description} ({STATUS_LABELS[sic.status]})
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-700">Es solo un aviso: podés enviar la solicitud igual.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {createdId && (
        <Link href={`/sic/${createdId}`} className="inline-block text-sm font-medium text-indigo-600 underline">
          Ir a la SIC creada
        </Link>
      )}

      <button
        type="submit"
        disabled={loading || !!createdId}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
