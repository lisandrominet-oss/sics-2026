"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ObraItemPicker from "@/components/obras/ObraItemPicker";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";

// Ítem de obra en el detalle de una SIC, con "Cambiar" para quien puede reclasificarla
// (Compras, admin, Ingeniería y el emisor mientras la SIC es editable). No cambia el estado de la SIC.
export default function SicObraItem({
  sicId,
  projectId,
  nodeId,
  label,
  path,
  canChange,
}: {
  sicId: string;
  projectId: string;
  nodeId: string | null;
  label: string | null;
  path: string;
  canChange: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(nodeId);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await createClient().rpc("set_sic_project_node", { p_sic_id: sicId, p_node_id: value });
    setSaving(false);
    if (error) {
      notify.error("No se pudo cambiar el ítem", error.message);
      return;
    }
    notify.success("Ítem de obra actualizado");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="min-w-0">
      <p className="mt-1.5 text-base font-medium text-slate-800 [overflow-wrap:anywhere]">{label ?? "General del proyecto"}</p>
      {path && <p className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">{path}</p>}
      {canChange && (
        <Button
          variant="link"
          size="sm"
          className="mt-1"
          onClick={() => {
            setValue(nodeId);
            setOpen(true);
          }}
        >
          Cambiar
        </Button>
      )}
      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Ítem de la obra">
        <div className="mt-3 space-y-4">
          <ObraItemPicker projectId={projectId} value={value} onChange={setValue} />
          <p className="text-xs text-slate-500">Queda registrado en el historial de la SIC. No cambia su estado ni el circuito.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={value === nodeId}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
