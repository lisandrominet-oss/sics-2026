"use client";

import { inputClass } from "@/lib/ui";
import Button from "@/components/ui/Button";
import InfoTip from "@/components/ui/InfoTip";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import ItemsEditor, { EMPTY_ITEM, type ItemDraft } from "@/components/ItemsEditor";
import ImportItemsModal from "@/components/ImportItemsModal";
import ObraItemPicker from "@/components/obras/ObraItemPicker";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { MAX_SIC_ITEMS, PROJECT_TALLER, STATUS_LABELS, formatSqlDate, sanitizeFileName, type SicStatus } from "@/lib/constants";

type Plant = { id: string; name: string; prefix: string };
type Project = { id: string; name: string };

// Un artículo sin nada cargado (el que aparece de entrada): al importar se reemplaza en vez de quedar vacío.
function isBlankItem(it: ItemDraft) {
  return !it.description.trim() && !it.quantity.trim() && !it.specs.trim() && !it.referenceLink.trim() && !it.file && !it.requiresQualityCert;
}

export default function NuevaSicForm({
  plants,
  projects,
  defaultPlantId,
  canPickPlant,
  catalog,
  initialProjectId = "",
  initialNodeId = null,
}: {
  plants: Plant[];
  projects: Project[];
  defaultPlantId: string | null;
  canPickPlant: boolean;
  catalog: string[];
  initialProjectId?: string;
  initialNodeId?: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const askingRef = useRef(false);
  // Si el usuario no tiene una planta asignada en su perfil, no hay nada a lo que
  // bloquearlo: mostramos el selector igual aunque su rol no sea compras/admin.
  const plantEditable = canPickPlant || !defaultPlantId;
  const [subject, setSubject] = useState("");
  const [neededByDate, setNeededByDate] = useState("");
  const [plantId, setPlantId] = useState(defaultPlantId ?? plants[0]?.id ?? "");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [projectNodeId, setProjectNodeId] = useState<string | null>(initialNodeId);
  const [onBehalfOf, setOnBehalfOf] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
  // Solo se descartan las tarjetas vacías del final: ItemsEditor recorta sus claves por el final,
  // así cada tarjeta que queda conserva la suya (y su archivo adjunto).
  let keep = items.length;
  while (keep > 0 && isBlankItem(items[keep - 1])) keep -= 1;
  const filledItems = items.slice(0, keep);

  function handleImport(imported: ItemDraft[]) {
    setItems([...filledItems, ...imported].slice(0, MAX_SIC_ITEMS));
    setImportOpen(false);
    notify.success(
      imported.length === 1 ? "Se agregó 1 artículo" : `Se agregaron ${imported.length} artículos`,
      "Revisalos antes de enviar la solicitud."
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // El ref cubre también el lapso en que el cartel está abierto (un segundo Enter no abre otro).
    if (loading || askingRef.current) return;
    askingRef.current = true;

    // Una vez enviada ya la ve el jefe o Compras: se pide confirmar con un resumen antes de crearla.
    const itemsLabel = `${items.length} ${items.length === 1 ? "artículo" : "artículos"}`;
    const confirmed = await confirm({
      title: "¿Enviar la solicitud?",
      description: `${subject.trim()} · ${itemsLabel}${neededByDate ? ` · necesaria para el ${formatSqlDate(neededByDate)}` : ""}. Revisá que esté todo bien. Mientras Compras no la tome, vas a poder editarla o anularla.`,
      confirmLabel: "Enviar",
      cancelLabel: "Revisar",
    });
    askingRef.current = false;
    if (!confirmed) return;

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
      p_project_id: projectId && projectId !== PROJECT_TALLER ? projectId : null,
      p_needed_by_date: neededByDate,
      // La moneda se define cuando Compras carga la cotización, no al pedirla.
      p_currency: "ARS",
      p_plant_id: plantId || null,
      p_items: payloadItems,
      p_on_behalf_of: canPickPlant ? onBehalfOf || null : null,
      p_project_node_id: projectNodeId,
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
        `La SIC se creó, pero no se pudo subir: ${failedFiles.join(", ")}. Podés abrirla y usar "Editar solicitud" para adjuntarlo de nuevo, o anularla y crearla otra vez.`
      );
      setLoading(false);
      return;
    }

    notify.success("SIC enviada", "Quedó registrada y pasa a revisión.");
    router.push(`/sic/${sic.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-900">Área</label>
          {plantEditable ? (
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              required
              className={inputClass}
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.prefix})
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 sm:min-h-9">
              {selectedPlantName ? `${selectedPlantName.name} (${selectedPlantName.prefix})` : "-"}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900">Seleccionar proyecto</label>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setProjectNodeId(null);
            }}
            required
            className={inputClass}
          >
            <option value="">Seleccionar…</option>
            <option value={PROJECT_TALLER}>Taller</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ObraItemPicker
        projectId={projectId && projectId !== PROJECT_TALLER ? projectId : null}
        value={projectNodeId}
        onChange={setProjectNodeId}
      />

      {canPickPlant && (
        <div>
          <div className="flex items-center gap-1.5">
            <label className="block text-sm font-medium text-slate-900">Solicita:</label>
            <InfoTip>Completalo solo si cargás esta SIC por alguien que no puede ingresar con su propio mail.</InfoTip>
          </div>
          <input
            value={onBehalfOf}
            onChange={(e) => setOnBehalfOf(e.target.value)}
            placeholder="Ej: Martín Vargas"
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-900">Asunto / razón de la compra</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Ej: Repuestos para torno CNC"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900">Fecha límite</label>
        <input
          type="date"
          value={neededByDate}
          onChange={(e) => setNeededByDate(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <label className="block text-sm font-medium text-slate-900">Artículos solicitados</label>
          <Button variant="link" size="sm" onClick={() => setImportOpen(true)} disabled={filledItems.length >= MAX_SIC_ITEMS}>
            Importar desde planilla
          </Button>
        </div>
        <div className="mt-2">
          <ItemsEditor items={items} onChange={setItems} catalog={catalog} />
        </div>
        <ImportItemsModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
          freeSlots={MAX_SIC_ITEMS - filledItems.length}
        />
      </div>

      {similar.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Puede que ya exista un pedido parecido en tu área:</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
            {similar.map((sic) => (
              <li key={sic.id} className="[overflow-wrap:anywhere]">
                <Link href={`/sic/${sic.id}`} target="_blank" className="font-semibold underline">
                  {sic.code}
                </Link>{" "}
                ({STATUS_LABELS[sic.status]})
                <span className="line-clamp-2 block" title={sic.description}>
                  {sic.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="animate-shake text-sm text-red-600 [overflow-wrap:anywhere]">{error}</p>}
      {createdId && (
        <Link href={`/sic/${createdId}`} className="inline-block text-sm font-medium text-slate-900 underline">
          Ir a la SIC creada
        </Link>
      )}

      {/* Barra de envío: queda fija abajo mientras se completa el formulario (también en celular, con la zona segura). */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-sheet px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex lg:justify-end lg:px-0 lg:pb-3">
        <Button type="submit" size="lg" loading={loading} disabled={!!createdId} className="w-full lg:w-auto lg:min-w-[12rem]">
          {loading ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}
