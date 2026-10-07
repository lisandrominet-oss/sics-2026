"use client";

import { inputClass } from "@/lib/ui";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ItemsEditor, { EMPTY_ITEM, type ItemDraft } from "@/components/ItemsEditor";
import {
  REQUESTER_CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
  sanitizeFileName,
  type SicFileType,
  type SicStatus,
  type UserRole,
} from "@/lib/constants";

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
  existingFileId: string | null;
  existingFilePath: string | null;
  reviewNote: string | null;
  requiresQualityCert: boolean;
  certFiles: SicFile[];
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
  isAreaBoss,
  existingFiles,
  editData,
  projects,
  purchaseType,
  finalAmount: savedAmount,
  currentAccountProviders,
  allProviders,
}: {
  sicId: string;
  status: SicStatus;
  role: UserRole;
  isRequester: boolean;
  isAreaBoss: boolean;
  existingFiles: SicFile[];
  editData: EditData;
  projects: { id: string; name: string }[];
  purchaseType: "normal" | "cuenta_corriente" | "directa";
  finalAmount: number | null;
  currentAccountProviders: { id: string; name: string }[];
  allProviders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [ccProviderId, setCcProviderId] = useState("");
  const [directAmount, setDirectAmount] = useState("");
  const [directProviderId, setDirectProviderId] = useState("");
  const [ccAmount, setCcAmount] = useState(savedAmount !== null ? String(savedAmount) : "");
  const comparacionInput = useRef<HTMLInputElement>(null);
  const ordenInput = useRef<HTMLInputElement>(null);

  const findFile = (type: SicFileType) => existingFiles.find((f) => f.file_type === type);
  const hasFactura = !!findFile("factura");
  const isCurrentAccount = purchaseType === "cuenta_corriente";
  const isDirect = purchaseType === "directa";
  const isCompras = ["compras", "admin"].includes(role);

  async function uploadFile(file: File, fileType: SicFileType, itemId?: string) {
    const supabase = createClient();
    const path = `${sicId}/${fileType}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("sic-files")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) throw upErr;
    const { error: rpcErr } = await supabase.rpc("attach_file", {
      p_sic_id: sicId,
      p_file_type: fileType,
      p_storage_path: path,
      p_file_name: file.name,
      ...(itemId ? { p_item_id: itemId } : {}),
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
      notify.success("Cambios guardados");
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

  // Compras/admin anulan en cualquier estado no terminal; quien emitió la SIC, solo antes de que Compras la acepte.
  const canCancel =
    (isCompras && !TERMINAL_STATUSES.includes(status)) ||
    (isRequester && REQUESTER_CANCELLABLE_STATUSES.includes(status));
  const canApproveAsBoss = role === "admin" || isAreaBoss;
  const canValidateTechnically = role === "admin" || isRequester || isAreaBoss;
  const itemsRequiringCert = editData.items.filter((it) => it.requiresQualityCert);
  const canManageCerts = ["compras", "admin"].includes(role) && itemsRequiringCert.length > 0;


  const CurrentAccountBlock = (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cuenta corriente</p>
      {currentAccountProviders.length === 0 ? (
        <p className="mt-2 text-xs text-amber-600">
          Ningún proveedor tiene cuenta corriente habilitada. Marcalo desde Proveedores → Editar datos.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={ccProviderId}
            onChange={(e) => setCcProviderId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Proveedor…</option>
            {currentAccountProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Btn
            onClick={() =>
              run(() =>
                supabase.rpc("classify_sic_current_account", {
                  p_sic_id: sicId,
                  p_provider_id: ccProviderId,
                  p_note: note || null,
                })
              )
            }
            loading={loading || !ccProviderId}
          >
            Aceptar como cuenta corriente
          </Btn>
        </div>
      )}
    </div>
  );

  const DirectBlock = (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compra directa</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={directAmount}
          onChange={(e) => setDirectAmount(e.target.value)}
          placeholder="Monto en ARS (obligatorio)"
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={directProviderId}
          onChange={(e) => setDirectProviderId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Proveedor (opcional)</option>
          {allProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Btn
          onClick={() =>
            run(() =>
              supabase.rpc("classify_sic_direct", {
                p_sic_id: sicId,
                p_amount: Number(directAmount),
                ...(directProviderId ? { p_provider_id: directProviderId } : {}),
                p_note: note || null,
              })
            )
          }
          loading={loading || !directAmount || Number(directAmount) <= 0}
        >
          Aceptar como compra directa
        </Btn>
      </div>
    </div>
  );

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
        {editData.items.length > 1 && (
          <ItemReviewPanel items={editData.items} sicId={sicId} stage="compras" onDone={() => { notify.success("Revisión por ítem registrada"); router.refresh(); }} />
        )}
        {CurrentAccountBlock}
        {DirectBlock}
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "pendiente_aprobacion_jefe" && canApproveAsBoss) {
    return (
      <ActionCard title="Aprobación del jefe de área">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Comentario — obligatorio si pedís corrección o rechazás"
          rows={2}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            onClick={() => run(() => supabase.rpc("jefe_review_sic", { p_sic_id: sicId, p_decision: "aceptar", p_note: note || null }))}
            loading={loading}
          >
            Aprobar
          </Btn>
          <Btn
            variant="warning"
            onClick={() => run(() => supabase.rpc("jefe_review_sic", { p_sic_id: sicId, p_decision: "observar", p_note: note || null }))}
            loading={loading || note.trim().length === 0}
          >
            Pedir corrección
          </Btn>
          <Btn
            variant="danger"
            onClick={() => run(() => supabase.rpc("jefe_review_sic", { p_sic_id: sicId, p_decision: "rechazar", p_note: note || null }))}
            loading={loading || note.trim().length === 0}
          >
            Rechazar
          </Btn>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Al aprobar, la SIC pasa a Compras. Rechazar es definitivo; para que la corrijan, usá "Pedir corrección".
        </p>
        {editData.items.length > 1 && (
          <ItemReviewPanel items={editData.items} sicId={sicId} stage="jefe" onDone={() => { notify.success("Revisión por ítem registrada"); router.refresh(); }} />
        )}
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "pendiente_aprobacion_jefe" && isRequester) {
    return (
      <ActionCard title="En revisión del jefe de área">
        <p className="text-sm text-slate-500">
          Tu solicitud está esperando la aprobación del jefe de tu área. Cuando la apruebe pasa a Compras.
        </p>
      </ActionCard>
    );
  }

  if (status === "en_observacion" && (role === "admin" || isRequester)) {
    return <ObservacionEditor sicId={sicId} editData={editData} projects={projects} onDone={() => { notify.success("SIC corregida y reenviada"); router.refresh(); }} />;
  }

  if (status === "cotizando" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Cotización y comparación de proveedores">
        <div className="space-y-2 text-sm">
          <MultiFileRow
            label="Cotizaciones (opcional)"
            files={existingFiles.filter((f) => f.file_type === "cotizacion")}
            onUpload={(f) => run(() => uploadFile(f, "cotizacion").then(() => ({ error: null })))}
            onDelete={(f) => run(() => deleteFile(f))}
          />
          <FileRow
            label="Comparación de precios (opcional)"
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
          className={inputClass}
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
        {CurrentAccountBlock}
        {DirectBlock}
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  if (status === "pendiente_validacion_tecnica" && canValidateTechnically) {
    return (
      <ActionCard title="Validación técnica">
        <p className="text-sm text-slate-500">Revisá la cotización y el monto antes de aprobar.</p>
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
          className={inputClass}
        />
        {NoteBox}
        <div className="mt-3">
          <Btn onClick={() => run(() => supabase.rpc("issue_po", { p_sic_id: sicId, p_po_number: poNumber || null, p_note: note || null }))} loading={loading}>
            Emitir orden de compra
          </Btn>
          {(isCurrentAccount || isDirect) && (
            <span className="ml-2">
              <Btn
                variant="warning"
                onClick={() => run(() => supabase.rpc("revert_sic_to_normal", { p_sic_id: sicId, p_note: note || null }))}
                loading={loading}
              >
                Volver a compra normal
              </Btn>
            </span>
          )}
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
        remitoFiles={existingFiles.filter((f) => f.file_type === "remito")}
        facturaFiles={existingFiles.filter((f) => f.file_type === "factura")}
        onUploadRemito={(f) => run(() => uploadFile(f, "remito").then(() => ({ error: null })))}
        onUploadFactura={(f) => run(() => uploadFile(f, "factura").then(() => ({ error: null })))}
        onDeleteFile={(f) => run(() => deleteFile(f))}
        onDone={() => { notify.success("Recepción registrada"); router.refresh(); }}
      />
    );
  }

  if (status === "recibida" && ["compras", "admin"].includes(role)) {
    return (
      <ActionCard title="Cierre de la SIC">
        <MultiFileRow
          label={isCurrentAccount ? "Facturas (opcional: en cuenta corriente llega mensual)" : "Facturas (obligatoria al menos una)"}
          files={existingFiles.filter((f) => f.file_type === "factura")}
          onUpload={(f) => run(() => uploadFile(f, "factura").then(() => ({ error: null })))}
          onDelete={(f) => run(() => deleteFile(f))}
        />
        {NoteBox}
        <div className="mt-3">
          <Btn
            onClick={() => run(() => supabase.rpc("close_sic", { p_sic_id: sicId, p_note: note || null }))}
            loading={loading || (isCurrentAccount ? savedAmount === null : !hasFactura)}
          >
            Cerrar SIC
          </Btn>
        </div>
        {isCurrentAccount
          ? savedAmount === null && <p className="mt-2 text-xs text-amber-600">Cargá el monto de la compra antes de cerrar la SIC.</p>
          : !hasFactura && <p className="mt-2 text-xs text-amber-600">Subí la factura antes de cerrar la SIC.</p>}
        {error && <Err>{error}</Err>}
      </ActionCard>
    );
  }

  return null;
  }

  return (
    <div className="space-y-4">
      {isCurrentAccount && isCompras && ["orden_emitida", "recibida"].includes(status) && (
        <ActionCard title="Monto de la compra (cuenta corriente)">
          <p className="text-xs text-slate-500">
            Cargalo con el remito en mano, sin IVA. Hace falta para poder cerrar la SIC y para la liquidación mensual.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={ccAmount}
              onChange={(e) => setCcAmount(e.target.value)}
              placeholder="Monto en ARS"
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <Btn
              onClick={() =>
                run(() =>
                  supabase.rpc("set_sic_current_account_amount", { p_sic_id: sicId, p_amount: Number(ccAmount), p_note: null })
                )
              }
              loading={loading || ccAmount === ""}
            >
              {savedAmount === null ? "Guardar monto" : "Actualizar monto"}
            </Btn>
          </div>
          {error && <Err>{error}</Err>}
        </ActionCard>
      )}
      {renderStatusPanel()}
      {canManageCerts && (
        <ActionCard title="Certificados de calidad">
          <p className="mb-3 text-xs text-slate-500">
            Se pueden subir en cualquier momento, aunque la SIC ya esté cerrada — no hace falta esperar a
            que llegue el certificado para avanzar con el resto del pedido.
          </p>
          <div className="space-y-2">
            {itemsRequiringCert.map((item) => (
              <MultiFileRow
                key={item.id}
                label={item.description}
                files={item.certFiles}
                onUpload={(f) =>
                  run(() => uploadFile(f, "certificado_calidad", item.id).then(() => ({ error: null })))
                }
                onDelete={(f) => run(() => deleteFile(f))}
              />
            ))}
          </div>
        </ActionCard>
      )}
      {canCancel && <CancelSicCard sicId={sicId} onDone={() => { notify.success("SIC anulada"); router.refresh(); }} />}
    </div>
  );
}

function CancelSicCard({ sicId, onDone }: { sicId: string; onDone: () => void }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) return;
    if (
      !(await confirm({
        title: "¿Anular esta SIC?",
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Anular SIC",
        destructive: true,
      }))
    )
      return;
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
        placeholder="Describe la razón"
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
  remitoFiles,
  facturaFiles,
  onUploadRemito,
  onUploadFactura,
  onDeleteFile,
  onDone,
}: {
  sicId: string;
  items: EditItem[];
  remitoFiles: SicFile[];
  facturaFiles: SicFile[];
  onUploadRemito: (file: File) => void;
  onUploadFactura: (file: File) => void;
  onDeleteFile: (file: SicFile) => void;
  onDone: () => void;
}) {
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
      <MultiFileRow
        label="Remitos (obligatorio al menos uno)"
        files={remitoFiles}
        onUpload={onUploadRemito}
        onDelete={onDeleteFile}
      />
      <div className="mt-2">
        <MultiFileRow
          label="Facturas (opcional en este paso)"
          files={facturaFiles}
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
        <Btn onClick={handleSubmit} loading={loading || remitoFiles.length === 0}>
          Registrar recepción
        </Btn>
      </div>
      {remitoFiles.length === 0 && (
        <p className="mt-2 text-xs text-amber-600">Subí al menos un remito antes de registrar la recepción.</p>
      )}
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
          id: it.id,
          description: it.description,
          quantity: String(it.quantity),
          specs: it.specs ?? "",
          referenceLink: it.referenceLink ?? "",
          file: null,
          existingFileName: it.existingFileName,
          existingFileId: it.existingFileId,
          existingFilePath: it.existingFilePath,
          reviewNote: it.reviewNote,
          requiresQualityCert: it.requiresQualityCert,
        }))
      : [{ ...EMPTY_ITEM }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payloadItems = items.map((it) => ({
      id: it.id ?? null,
      description: it.description,
      quantity: Number(it.quantity),
      specs: it.specs || null,
      reference_link: it.referenceLink || null,
      requires_quality_cert: it.requiresQualityCert,
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
      .eq("review_status", "activo")
      .order("position", { ascending: true });

    const failedFiles: string[] = [];
    if (newItems) {
      for (let i = 0; i < items.length; i++) {
        const file = items[i].file;
        const itemRow = newItems[i];
        if (!file || !itemRow) continue;
        const previous = items[i];
        if (previous.existingFileId && previous.existingFilePath) {
          await supabase.storage.from("sic-files").remove([previous.existingFilePath]);
          await supabase.rpc("delete_sic_file", { p_file_id: previous.existingFileId });
        }
        const path = `${sicId}/referencia/${itemRow.id}/${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("sic-files")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) {
          failedFiles.push(file.name);
          continue;
        }
        const { error: attachErr } = await supabase.rpc("attach_file", {
          p_sic_id: sicId,
          p_file_type: "referencia",
          p_storage_path: path,
          p_file_name: file.name,
          p_item_id: itemRow.id,
        });
        if (attachErr) failedFiles.push(file.name);
      }
    }

    setLoading(false);
    if (failedFiles.length > 0) {
      notify.error("La SIC se reenvió, pero no se pudo subir un archivo", `${failedFiles.join(", ")}. Avisale a Compras.`);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-sm font-semibold text-slate-900">Corregir y reenviar</h2>
      <p className="mt-1 text-xs text-slate-500">
        Los archivos de referencia ya subidos se conservan. Adjuntá uno nuevo solo si querés reemplazar el anterior.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700">Asunto</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Necesaria para</label>
          <input
            type="date"
            value={neededByDate}
            onChange={(e) => setNeededByDate(e.target.value)}
            required
            className={inputClass}
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
            className={inputClass}
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
          {loading ? "Guardando…" : "Guardar y reenviar"}
        </button>
      </div>
    </form>
  );
}

type ItemDecision = "aceptar" | "observar" | "rechazar";

const DECISION_STYLES: Record<ItemDecision, { label: string; active: string }> = {
  aceptar: { label: "Aprobar", active: "bg-emerald-600 text-white border-emerald-600" },
  observar: { label: "Observar", active: "bg-amber-500 text-white border-amber-500" },
  rechazar: { label: "Rechazar", active: "bg-red-600 text-white border-red-600" },
};

function ItemReviewPanel({
  sicId,
  items,
  stage,
  onDone,
}: {
  sicId: string;
  items: EditItem[];
  stage: "jefe" | "compras";
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>(
    Object.fromEntries(items.map((it) => [it.id, "aceptar" as ItemDecision]))
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [generalNote, setGeneralNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = (d: ItemDecision) => items.filter((it) => decisions[it.id] === d).length;
  const nAcc = count("aceptar");
  const nObs = count("observar");
  const nRej = count("rechazar");
  const missingNote = items.some((it) => decisions[it.id] !== "aceptar" && !(notes[it.id] ?? "").trim());

  let consequence: string;
  if (nAcc === 0 && nObs === 0) consequence = "Todos rechazados: la SIC queda rechazada.";
  else if (nAcc === 0) consequence = "Sin aprobados: la SIC vuelve entera al solicitante para que la corrija.";
  else if (nObs > 0)
    consequence = `La SIC sigue con ${nAcc} aprobado(s). ${nObs} observado(s) pasan a una SIC nueva para corregir${
      nRej > 0 ? `; ${nRej} rechazado(s) quedan tachados` : ""
    }.`;
  else if (nRej > 0) consequence = `La SIC sigue con ${nAcc} aprobado(s); ${nRej} rechazado(s) quedan tachados y no se compran.`;
  else consequence = stage === "jefe" ? "Todos aprobados: la SIC pasa a Compras." : "Todos aprobados: la SIC pasa a cotización.";

  async function submit() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("review_sic_items", {
      p_sic_id: sicId,
      p_decisions: items.map((it) => ({
        item_id: it.id,
        decision: decisions[it.id],
        note: decisions[it.id] === "aceptar" ? null : (notes[it.id] ?? "").trim(),
      })),
      p_note: generalNote.trim() || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  if (!open) {
    return (
      <div className="mt-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Revisar artículo por artículo
        </button>
        <p className="mt-1 text-xs text-slate-400">
          Aprobá unos, observá otros y rechazá los que no correspondan, todo en una sola revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revisión por artículo</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
          Cerrar
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((it, i) => {
          const d = decisions[it.id];
          return (
            <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-800">
                  <span className="text-slate-400">{i + 1}.</span> {it.description}{" "}
                  <span className="text-slate-400">— {it.quantity}</span>
                </p>
                <div className="flex gap-1">
                  {(Object.keys(DECISION_STYLES) as ItemDecision[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDecisions({ ...decisions, [it.id]: k })}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        d === k ? DECISION_STYLES[k].active : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {DECISION_STYLES[k].label}
                    </button>
                  ))}
                </div>
              </div>
              {d !== "aceptar" && (
                <input
                  value={notes[it.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [it.id]: e.target.value })}
                  placeholder={d === "observar" ? "Qué hay que corregir (obligatorio)" : "Motivo del rechazo (obligatorio)"}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
      <textarea
        value={generalNote}
        onChange={(e) => setGeneralNote(e.target.value)}
        placeholder="Comentario general (opcional)"
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <p className="mt-3 text-xs font-medium text-slate-600">
        {nAcc} aprobado(s) · {nObs} observado(s) · {nRej} rechazado(s)
      </p>
      <p className="mt-1 text-xs text-slate-500">{consequence}</p>
      <div className="mt-3">
        <Btn onClick={submit} loading={loading || missingNote}>
          Confirmar revisión
        </Btn>
      </div>
      {missingNote && <p className="mt-2 text-xs text-amber-600">Falta el motivo de algún artículo observado o rechazado.</p>}
      {error && <Err>{error}</Err>}
    </div>
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
  return <p role="alert" className="animate-shake mt-2 text-sm text-red-600">{children}</p>;
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
