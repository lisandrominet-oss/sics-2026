"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import PromptDialog from "@/components/ui/PromptDialog";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { compressImage } from "@/lib/remitosFiles";
import { filterClass } from "@/lib/ui";
import { CAN, REMITO_BUCKET, untyped, type RemitoDispatch, type RemitoRole } from "@/lib/remitos";

// Acciones de un despacho ya confirmado: N° de remito oficial, foto del remito firmado y anulación.
export default function RemitoDetailActions({ dispatch, role }: { dispatch: RemitoDispatch; role: RemitoRole }) {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const [officialOpen, setOfficialOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canEdit = CAN.armarDespachos(role) && dispatch.status !== "anulado";

  async function setOfficial(values: Record<string, string>) {
    const { error } = await supabase.rpc("remito_set_official_no", { p_dispatch_id: dispatch.id, p_official_no: values.numero ?? "", p_line_id: null });
    if (error) {
      notify.error("No se pudo guardar el número", error.message);
      return false;
    }
    notify.success("N° de remito oficial guardado");
    router.refresh();
  }

  async function cancel(values: Record<string, string>) {
    const { error } = await supabase.rpc("remito_cancel_dispatch", { p_dispatch_id: dispatch.id, p_reason: values.motivo ?? "" });
    if (error) {
      notify.error("No se pudo anular", error.message);
      return false;
    }
    notify.success("Despacho anulado, el stock se repuso");
    router.refresh();
  }

  async function uploadOfficial(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const blob = await compressImage(file, 2000);
        const path = `${dispatch.id}/remito-oficial-${Date.now()}.jpg`;
        const up = await supabase.storage.from(REMITO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw new Error(up.error.message);
        const { error } = await supabase.rpc("remito_attach_file", { p_dispatch_id: dispatch.id, p_kind: "remito_oficial", p_path: path });
        if (error) {
          await supabase.storage.from(REMITO_BUCKET).remove([path]);
          throw new Error(error.message);
        }
      }
      notify.success("Remito oficial adjuntado");
      router.refresh();
    } catch (err) {
      notify.error("No se pudo subir el archivo", err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setOfficialOpen(true)}>
        {dispatch.official_no ? "Cambiar N° oficial" : "Asignar N° oficial"}
      </Button>
      <label className={`${filterClass} inline-flex cursor-pointer items-center text-[13px] ${uploading ? "pointer-events-none opacity-60" : ""}`}>
        {uploading ? "Subiendo…" : "Subir foto del remito oficial"}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { uploadOfficial(e.target.files); e.target.value = ""; }} />
      </label>
      <Button variant="danger-outline" size="sm" onClick={() => setCancelOpen(true)}>Anular remito</Button>

      <PromptDialog
        open={officialOpen}
        onClose={() => setOfficialOpen(false)}
        title="N° de remito oficial"
        description="El número del remito oficial con el que salió la carga. Dejalo vacío para quitarlo."
        fields={[{ name: "numero", label: "Número" }]}
        confirmLabel="Guardar"
        onSubmit={setOfficial}
      />
      <PromptDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Anular remito"
        description="El despacho queda anulado y el stock vuelve al catálogo. No se puede deshacer."
        fields={[{ name: "motivo", label: "Motivo de la anulación", required: dispatch.status === "confirmado" }]}
        confirmLabel="Anular"
        destructive
        onSubmit={cancel}
      />
    </div>
  );
}
