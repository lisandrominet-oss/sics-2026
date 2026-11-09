"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { inputClass } from "@/lib/ui";
import { untyped, type CalTemplate } from "@/lib/calidad";

// Plantillas de etapas: el molde con el que se crean los grupos (ej. Estructura metálica, Correas, Cocina).
export default function CalidadTemplates({ templates, canEdit }: { templates: CalTemplate[]; canEdit: boolean }) {
  const [dlg, setDlg] = useState<{ open: boolean; tpl: CalTemplate | null }>({ open: false, tpl: null });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-sm text-slate-500">
          Cada grupo copia las etapas de una plantilla al crearse. Cambiar una plantilla después no modifica los grupos que ya existen.
        </p>
        {canEdit && <Button size="sm" onClick={() => setDlg({ open: true, tpl: null })}>Nueva plantilla</Button>}
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id}>
            <Card className="h-full">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{t.name}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  {!t.active && <Badge tone="muted" size="sm">Archivada</Badge>}
                  {canEdit && <Button size="sm" variant="link" onClick={() => setDlg({ open: true, tpl: t })}>Editar</Button>}
                </div>
              </div>
              <ol className="mt-3 flex flex-wrap gap-1.5">
                {t.stages.map((s, i) => (
                  <li key={`${s}-${i}`}>
                    <Badge tone="neutral" size="sm">{i + 1}. {s}</Badge>
                  </li>
                ))}
              </ol>
            </Card>
          </li>
        ))}
      </ul>
      {canEdit && (
        <Modal open={dlg.open} onClose={() => setDlg((d) => ({ ...d, open: false }))} title={dlg.tpl ? "Editar plantilla" : "Nueva plantilla"}>
          <TemplateForm tpl={dlg.tpl} onClose={() => setDlg((d) => ({ ...d, open: false }))} />
        </Modal>
      )}
    </div>
  );
}

function TemplateForm({ tpl, onClose }: { tpl: CalTemplate | null; onClose: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const [name, setName] = useState(tpl?.name ?? "");
  const [stages, setStages] = useState((tpl?.stages ?? []).join("\n"));
  const [active, setActive] = useState(tpl?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const list = stages.split("\n").map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    const { error } = await supabase.rpc("cal_save_template", { p_id: tpl?.id ?? null, p_name: name, p_stages: list, p_active: active });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar la plantilla", error.message);
    notify.success(tpl ? "Plantilla actualizada" : "Plantilla creada");
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" hint="Por ejemplo «Cocina» o «Estructura metálica».">
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={inputClass} autoFocus />}
      </Field>
      <Field label="Etapas" hint="Una por línea, en el orden de la planilla. La última es la etapa final (En sitio, Instalado…).">
        {(p) => <textarea {...p} value={stages} onChange={(e) => setStages(e.target.value)} required rows={8} className={`${inputClass} font-[inherit]`} />}
      </Field>
      {tpl && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-900 sm:min-h-0">
          <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} className="h-4 w-4" />
          Archivada (no se ofrece al crear grupos nuevos)
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button type="submit" loading={busy}>Guardar</Button>
      </div>
    </form>
  );
}
