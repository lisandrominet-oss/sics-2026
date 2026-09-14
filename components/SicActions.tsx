"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ItemsEditor, { type ItemDraft } from "@/components/ItemsEditor";
import type { SicFileType, SicStatus, UserRole } from "@/lib/constants";

type SicFile = {
  id: string;
  file_type: SicFileType;
  storage_path: string;
  file_name: string;
};

type EditItem = {
  id: string;
  description: string;
  quantity: number;
  receivedQuantity: number;
  specs: string | null;
  referenceLink: string | null;
  existingFileName: string | null;
};

type EditData = {
  subject: string;
  projectId: string | null;
  neededByDate: string | null;
  items: EditItem[];
};

export default function SicActions({
  sicId,
  status,
  role,
  isRequester,
  existingFiles,
  editData,
  projects,
}: {
  sicId: string;
  status: SicStatus;
  role: UserRole;
  isRequester: boolean;
  existingFiles: SicFile[];
  editData: EditData;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const comparacionInput = useRef<HTMLInputElement>(null);
  const facturaInput = useRef<HTMLInputElement>(null);
  const ordenInput = useRef<HTMLInputElement>(null);

  const findFile = (type: SicFileType) => existingFiles.find((f) => f.file_type === type);
  const hasFactura = !!findFile("factura");

  async function uploadFile(file: File, fileType: SicFileType) {
    const supabase = createClient();
    const path = `${sicId}/${fileType}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("sic-files").upload(path, file);
    if (upErr) throw upErr;
    const { error: rpcErr } = await supabase.rpc("attach_file", {
      p_sic_id: sicId,
      p_file_type: fileType,
      p_storage_path: path,
      p_file_name: file.name,
    });
    if (rpcErr) throw rpcErr;
  }

  async function deleteFile(file: SicFile) {
    const supabase = createClient();
    await supabase.storage.from("sic-files").remove([file.storage_path]);
    return supabase.rpc("delete_sic_file", { p_file_id: file.id });
  }

  async function run(action: () => Promise<{ error: { message: string } | null }>) {
    setLoading(true);
    setError(null);
    try {
      const { error } = await action();
      if (error) {
        setError(error.message);
        return;
      }
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  const supabase = createClient();
  const NoteBox = (
    <textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="Comentario (opcional)"
      rows={2}
      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
    />
  );

  const canCancel = ["compras", "admin"].includes(role) && !["cerrada", "anulada"].includes(status);

  function renderStatusPanel(): React.ReactNode {
  if (status === "enviada" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Revisión de Compras">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Comentario — obligatorio si pedís corrección"
          rows={2}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={() => run(() => supabase.rpc("compras_review_sic", { p_sic_id: sicId, p_decision: "aceptar", p_note: note || null }))}
            loading={loading}
          >
            Aceptar
          </Btn>
          <Btn
            variant="warning"
            onClick={() => run(() => supabase.rpc("compras_review_sic", { p_sic_id: sicId, p_decision: "observar", p_note: note || null }))}
            loading={loading || note.trim().length === 0}
          >
            Pedir corrección
          </Btn>
          <Btn
            variant="danger"
            onClick={() => run(() => supabase.rpc("compras_review_sic", { p_sic_id: sicId, p_decision: "rechazar", p_note: note || null }))}
            loading={loading}
          >
            Rechazar
          </Btn>
        </div>
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "en_observacion" && (role === "admin" || isRequester)) {
    return <ObservacionEditor sicId={sicId} editData={editData} projects={projects} onDone={() => router.refresh()} />;
  }

  if (status === "cotizando" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Cotización y comparación de proveedores">
        <div className="space-y-2 text-sm">
          <MultiFileRow
            label="Cotizaciones (una por proveedor)"
            files={existingFiles.filter((f) => f.file_type === "cotizacion")}
            onUpload={(f) => run(() => uploadFile(f, "cotizacion").then(() => ({ error: null })))}
            onDelete={(f) => run(() => deleteFile(f))}
          />
          <FileRow
            label="Comparación de precios"
            inputRef={comparacionInput}
            file={findFile("comparacion")}
            onUpload={(f) => run(() => uploadFile(f, "comparacion").then(() => ({ error: null })))}
            onDelete={(f) => run(() => deleteFile(f))}
          />
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Monto final elegido</label>
        <input
          type="number"
          step="0.01"
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {NoteBox}
        <div className="mt-3">
          <Btn
            onClick={() =>
              run(() =>
                supabase.rpc("submit_quotes", {
                  p_sic_id: sicId,
                  p_final_amount: Number(finalAmount),
                  p_note: note || null,
                })
              )
            }
            loading={loading || !finalAmount}
          >
            Enviar a validación técnica
          </Btn>
        </div>
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "pendiente_validacion_tecnica" && (role === "admin" || isRequester)) {
    return (
      <ActionCard title="Validación técnica">
        <p className="text-sm text-slate-500">Revisá las cotizaciones y la comparación antes de aprobar.</p>
        {NoteBox}
        <div className="mt-3 flex gap-2">
          <Btn onClick={() => run(() => supabase.rpc("technical_review", { p_sic_id: sicId, p_aprobar: true, p_note: note || null }))} loading={loading}>
            Aprobar
          </Btn>
          <Btn variant="danger" onClick={() => run(() => supabase.rpc("technical_review", { p_sic_id: sicId, p_aprobar: false, p_note: note || null }))} loading={loading}>
            Pedir corrección
          </Btn>
        </div>
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "pendiente_aprobacion_gerencia" && ["gerencia", "admin"].includes(role)) {
    return (
      <ActionCard title="Aprobación de Gerencia">
        {NoteBox}
        <div className="mt-3 flex gap-2">
          <Btn onClick={() => run(() => supabase.rpc("gerencia_decision", { p_sic_id: sicId, p_aprobar: true, p_note: note || null }))} loading={loading}>
            Aprobar
          </Btn>
          <Btn variant="danger" onClick={() => run(() => supabase.rpc("gerencia_decision", { p_sic_id: sicId, p_aprobar: false, p_note: note || null }))} loading={loading}>
            Rechazar
          </Btn>
        </div>
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "aprobada" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Emitir orden de compra">
        <FileRow
          label="Orden de compra (opcional)"
          inputRef={ordenInput}
          file={findFile("orden_compra")}
          onUpload={(f) => run(() => uploadFile(f, "orden_compra").then(() => ({ error: null })))}
          onDelete={(f) => run(() => deleteFile(f))}
        />
        <label className="mt-3 block text-sm font-medium text-slate-700">Número de orden (opcional)</label>
        <input
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {NoteBox}
        <div className="mt-3">
          <Btn onClick={() => run(() => supabase.rpc("issue_po", { p_sic_id: sicId, p_po_number: poNumber || null, p_note: note || null }))} loading={loading}>
            Emitir orden de compra
          </Btn>
        </div>
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "orden_emitida" && ["panol", "admin"].includes(role)) {
    return (
      <RecepcionEditor
        sicId={sicId}
        items={editData.items}
        remitoFile={findFile("remito")}
        facturaFile={findFile("factura")}
        onUploadRemito={(f) => run(() => uploadFile(f, "remito").then(() => ({ error: null })))}
        onUploadFactura={(f) => run(() => uploadFile(f, "factura").then(() => ({ error: null })))}
        onDeleteFile={(f) => run(() => deleteFile(f))}
        onDone={() => router.refresh()}
      />
    );
  }

  if (status === "recibida" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Cierre de la SIC">
        <FileRow
          label="Factura (obligatoria)"
          inputRef={facturaInput}
          file={findFile("factura")}
          onUpload={(f) => run(() => uploadFile(f, "factura").then(() => ({ error: null })))}
          onDelete={(f) => run(() => deleteFile(f))}
        />
        {NoteBox}
        <div className="mt-3">
          <Btn onClick={() => run(() => supabase.rpc("close_sic", { p_sic_id: sicId, p_note: note || null }))} loading={loading || !hasFactura}>
            Cerrar SIC
          </Btn>
        </div>
        {!hasFactura && <p className="mt-2 text-xs text-amber-600">Subí la factura antes de cerrar la SIC.</p>}
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  return null;
  }

  return (
    <div className="space-y-4">
      {renderStatusPanel()}
      {canCancel && <CancelSicCard sicId={sicId} onDone={() => router.refresh()} />}
    </div>
  );
}

function CancelSicCard({ sicId, onDone }: { sicId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) return;
    if (!confirm("¿Confirmás que querés anular esta SIC? Esta acción no se puede deshacer.")) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_sic", { p_sic_id: sicId, p_note: reason.trim() });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-red-700 hover:underline"
        >
          Anular esta SIC
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h2 className="text-sm font-semibold text-red-800">Anular SIC</h2>
      <p className="mt-1 text-xs text-red-700">
        Usalo para dar de baja una SIC por error, duplicado u otro motivo. Queda registrada en el historial,
        no se elimina.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo — obligatorio, ej: Duplicado de SIC"
        rows={2}
        className="mt-3 w-full rounded-lg border border-red-300 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading || !reason.trim()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? "Anulando…" : "Confirmar anulación"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white"
        >
          Cancelar
        </button>
      </div>
      {error && <Err>{error}</Err>}
    </div>
  );
}

function RecepcionEditor({
  sicId,
  items,
  remitoFile,
  facturaFile,
  onUploadRemito,
  onUploadFactura,
  onDeleteFile,
  onDone,
}: {
  sicId: string;
  items: EditItem[];
  remitoFile?: SicFile;
  facturaFile?: SicFile;
  onUploadRemito: (file: File) => void;
  onUploadFactura: (file: File) => void;
  onDeleteFile: (file: SicFile) => void;
  onDone: () => void;
}) {
  const remitoInput = useRef<HTMLInputElement>(null);
  const facturaInput = useRef<HTMLInputElement>(null);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(items.map((it) => [it.id, String(Math.max(it.quantity - it.receivedQuantity, 0))]))
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const deliveries = items
      .map((it) => ({ item_id: it.id, quantity_received: Number(qty[it.id] || 0) }))
      .filter((d) => d.quantity_received > 0);

    const { error } = await supabase.rpc("record_delivery", {
      p_sic_id: sicId,
      p_deliveries: deliveries,
      p_note: note || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <ActionCard title="Recepción de mercadería">
      <FileRow
        label="Remito (obligatorio al menos uno)"
        inputRef={remitoInput}
        file={remitoFile}
        onUpload={onUploadRemito}
        onDelete={onDeleteFile}
      />
      <div className="mt-2">
        <FileRow
          label="Factura (opcional en este paso)"
          inputRef={facturaInput}
          file={facturaFile}
          onUpload={onUploadFactura}
          onDelete={onDeleteFile}
        />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase text-slate-400">Cantidad recibida ahora, por artículo</p>
        {items.map((it) => {
          const remaining = Math.max(it.quantity - it.receivedQuantity, 0);
          return (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-sm text-slate-700">
                {it.description}
                <span className="ml-2 text-xs text-slate-400">
                  ({it.receivedQuantity}/{it.quantity} recibido)
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max={remaining}
                value={qty[it.id] ?? ""}
                onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
                disabled={remaining <= 0}
                className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50"
              />
            </div>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Comentario (opcional)"
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="mt-3">
        <Btn onClick={handleSubmit} loading={loading || !remitoFile}>
          Registrar recepción
        </Btn>
      </div>
      {!remitoFile && <p className="mt-2 text-xs text-amber-600">Subí el remito antes de registrar la recepción.</p>}
      <p className="mt-2 text-xs text-slate-400">
        Si llega menos de lo pedido, dejá cargada solo la cantidad que llegó ahora — la SIC queda abierta hasta
        recibir el resto.
      </p>
      {error && <Err>{error}</Err>}
    </ActionCard>
  );
}

function ObservacionEditor({
  sicId,
  editData,
  projects,
  onDone,
}: {
  sicId: string;
  editData: EditData;
  projects: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [subject, setSubject] = useState(editData.subject);
  const [projectId, setProjectId] = useState(editData.projectId ?? projects[0]?.id ?? "");
  const [neededByDate, setNeededByDate] = useState(editData.neededByDate ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    editData.items.length > 0
      ? editData.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          specs: it.specs ?? "",
          referenceLink: it.referenceLink ?? "",
          file: null,
          existingFileName: it.existingFileName,
        }))
      : [{ description: "", quantity: "", specs: "", referenceLink: "", file: null }]
  );
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

    const { data: sic, error: updateError } = await supabase.rpc("update_sic_details", {
      p_sic_id: sicId,
      p_subject: subject,
      p_project_id: projects.length > 0 ? projectId || null : null,
      p_needed_by_date: neededByDate,
      p_items: payloadItems,
    });

    if (updateError || !sic) {
      setError(updateError?.message ?? "No se pudo guardar");
      setLoading(false);
      return;
    }

    const { data: newItems } = await supabase
      .from("sic_items")
      .select("id, position")
      .eq("sic_id", sicId)
      .order("position", { ascending: true });

    if (newItems) {
      for (let i = 0; i < items.length; i++) {
        const file = items[i].file;
        const itemRow = newItems[i];
        if (!file || !itemRow) continue;
        const path = `${sicId}/referencia/${itemRow.id}/${file.name}`;
        const { error: upErr } = await supabase.storage.from("sic-files").upload(path, file);
        if (upErr) continue;
        await supabase.rpc("attach_file", {
          p_sic_id: sicId,
          p_file_type: "referencia",
          p_storage_path: path,
          p_file_name: file.name,
          p_item_id: itemRow.id,
        });
      }
    }

    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-sm font-semibold text-slate-900">Corregir y reenviar a Compras</h2>
      <p className="mt-1 text-xs text-slate-500">
        Al reenviar, los archivos de referencia anteriores se reemplazan — volvé a adjuntar los que sigan siendo válidos.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Asunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Necesaria para</label>
          <input
            type="date"
            value={neededByDate}
            onChange={(e) => setNeededByDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {projects.length > 1 && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700">Proyecto</label>
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

      <div className="mt-4">
        <ItemsEditor items={items} onChange={setItems} />
      </div>

      {error && <Err>{error}</Err>}

      <div className="mt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Guardando…" : "Guardar y reenviar a Compras"}
        </button>
      </div>
    </form>
  );
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  loading,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  variant?: "primary" | "danger" | "warning";
}) {
  const colors =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-500"
      : variant === "warning"
        ? "bg-amber-600 hover:bg-amber-500"
        : "bg-indigo-600 hover:bg-indigo-500";
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${colors}`}
    >
      {children}
    </button>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-red-600">{children}</p>;
}

function MultiFileRow({
  label,
  files,
  onUpload,
  onDelete,
}: {
  label: string;
  files: SicFile[];
  onUpload: (file: File) => void;
  onDelete: (file: SicFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-700">{label}</span>
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              onUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + Agregar
          </button>
        </div>
      </div>
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-sm">
              <span className="text-emerald-600">✓ {f.file_name}</span>
              <button
                type="button"
                onClick={() => onDelete(f)}
                className="text-xs font-medium text-red-600 underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Todavía no hay archivos.</p>
      )}
    </div>
  );
}

function FileRow({
  label,
  inputRef,
  file,
  onUpload,
  onDelete,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement>;
  file?: SicFile;
  onUpload: (file: File) => void;
  onDelete: (file: SicFile) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-slate-700">
        {label}{" "}
        {file && (
          <span className="ml-1 text-emerald-600">
            ✓ {file.file_name}{" "}
            <button
              type="button"
              onClick={() => onDelete(file)}
              className="ml-1 text-red-600 underline"
            >
              Eliminar
            </button>
          </span>
        )}
      </span>
      <div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (file) onDelete(file);
            onUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {file ? "Reemplazar" : "Subir archivo"}
        </button>
      </div>
    </div>
  );
}
