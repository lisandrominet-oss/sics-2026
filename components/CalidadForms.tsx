"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { IconX } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { inputClass } from "@/lib/ui";
import { untyped, type CalBay, type CalGroup, type CalItem, type CalProject, type CalStage, type CalTemplate } from "@/lib/calidad";

// Diálogos de alta y edición del módulo Calidad (proyecto, sector, grupo, etapas, elemento).
// Cada formulario solo existe con el diálogo abierto: al reabrir arranca con los datos actuales.

function useRpc() {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  return { router, supabase };
}

function Footer({ busy, onClose, label = "Guardar", extra }: { busy: boolean; onClose: () => void; label?: string; extra?: ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
      {extra && <div className="mr-auto">{extra}</div>}
      <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
        Cancelar
      </Button>
      <Button type="submit" loading={busy}>
        {label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- proyecto
export function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: CalProject | null }) {
  return (
    <Modal open={open} onClose={onClose} title={project ? "Editar proyecto" : "Nuevo proyecto"}>
      <ProjectForm project={project ?? null} onClose={onClose} />
    </Modal>
  );
}

function ProjectForm({ project, onClose }: { project: CalProject | null; onClose: () => void }) {
  const { router, supabase } = useRpc();
  const confirm = useConfirm();
  const [code, setCode] = useState(project?.code ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("cal_save_project", { p_id: project?.id ?? null, p_code: code, p_name: name });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar el proyecto", error.message);
    notify.success(project ? "Proyecto actualizado" : "Proyecto creado");
    onClose();
    if (project) router.refresh();
    else router.push(`/calidad/${data as string}`);
  }

  async function archive() {
    if (!project) return;
    const ok = await confirm({
      title: `¿Archivar el proyecto ${project.code}?`,
      description: "Deja de verse en el listado. Todo su avance y su historial quedan guardados.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("cal_set_active", { p_entity: "project", p_id: project.id, p_active: false });
    setBusy(false);
    if (error) return notify.error("No se pudo archivar", error.message);
    notify.success("Proyecto archivado");
    onClose();
    router.push("/calidad");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Código" hint="Como lo llama la obra, por ejemplo A9JM.">
        {(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} required maxLength={40} className={inputClass} autoFocus />}
      </Field>
      <Field label="Nombre">
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={inputClass} />}
      </Field>
      <Footer
        busy={busy}
        onClose={onClose}
        extra={project && <Button type="button" variant="link-danger" onClick={archive} disabled={busy}>Archivar proyecto</Button>}
      />
    </form>
  );
}

// ---------------------------------------------------------------- sector (bahía, cocina…)
export function BayDialog({ open, onClose, projectId, bay }: { open: boolean; onClose: () => void; projectId: string; bay?: CalBay | null }) {
  return (
    <Modal open={open} onClose={onClose} title={bay ? "Editar sector" : "Nuevo sector"}>
      <BayForm projectId={projectId} bay={bay ?? null} onClose={onClose} />
    </Modal>
  );
}

function BayForm({ projectId, bay, onClose }: { projectId: string; bay: CalBay | null; onClose: () => void }) {
  const { router, supabase } = useRpc();
  const confirm = useConfirm();
  const [name, setName] = useState(bay?.name ?? "");
  const [responsible, setResponsible] = useState(bay?.responsible ?? "");
  const [due, setDue] = useState(bay?.due_date ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("cal_save_bay", {
      p_id: bay?.id ?? null,
      p_project_id: projectId,
      p_name: name,
      p_responsible: responsible,
      p_due_date: due || null,
    });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar el sector", error.message);
    notify.success(bay ? "Sector actualizado" : "Sector creado");
    onClose();
    if (bay) router.refresh();
    else router.push(`/calidad/${projectId}?bahia=${data as string}`);
  }

  async function archive() {
    if (!bay) return;
    const ok = await confirm({
      title: `¿Archivar «${bay.name}»?`,
      description: "Deja de verse en el tablero. Su avance y su historial quedan guardados.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("cal_set_active", { p_entity: "bay", p_id: bay.id, p_active: false });
    setBusy(false);
    if (error) return notify.error("No se pudo archivar", error.message);
    notify.success("Sector archivado");
    onClose();
    router.push(`/calidad/${projectId}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" hint="Por ejemplo «Bahía 1» o «Cocina A9JM».">
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={inputClass} autoFocus />}
      </Field>
      <Field label="Responsable" hint="Como en la minuta, texto libre (ej. Manuel A. / Francisco G.).">
        {(p) => <input {...p} value={responsible} onChange={(e) => setResponsible(e.target.value)} maxLength={160} className={inputClass} />}
      </Field>
      <Field label="Fecha compromiso">
        {(p) => <input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />}
      </Field>
      <Footer
        busy={busy}
        onClose={onClose}
        extra={bay && <Button type="button" variant="link-danger" onClick={archive} disabled={busy}>Archivar sector</Button>}
      />
    </form>
  );
}

// ---------------------------------------------------------------- grupo
export function GroupDialog({
  open, onClose, bayId, group, templates,
}: { open: boolean; onClose: () => void; bayId: string; group?: CalGroup | null; templates: CalTemplate[] }) {
  return (
    <Modal open={open} onClose={onClose} title={group ? "Editar grupo" : "Nuevo grupo"}>
      <GroupForm bayId={bayId} group={group ?? null} templates={templates} onClose={onClose} />
    </Modal>
  );
}

function GroupForm({ bayId, group, templates, onClose }: { bayId: string; group: CalGroup | null; templates: CalTemplate[]; onClose: () => void }) {
  const { router, supabase } = useRpc();
  const confirm = useConfirm();
  const active = templates.filter((t) => t.active);
  const [name, setName] = useState(group?.name ?? "");
  const [templateId, setTemplateId] = useState(active[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const picked = active.find((t) => t.id === templateId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("cal_save_group", {
      p_id: group?.id ?? null,
      p_bay_id: bayId,
      p_name: name,
      p_template_id: group ? null : templateId || null,
    });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar el grupo", error.message);
    notify.success(group ? "Grupo actualizado" : "Grupo creado");
    onClose();
    router.refresh();
  }

  async function archive() {
    if (!group) return;
    const ok = await confirm({
      title: `¿Archivar «${group.name}»?`,
      description: "Deja de verse en el tablero. Su avance y su historial quedan guardados.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("cal_set_active", { p_entity: "group", p_id: group.id, p_active: false });
    setBusy(false);
    if (error) return notify.error("No se pudo archivar", error.message);
    notify.success("Grupo archivado");
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" hint="Por ejemplo «Estructura lateral», «Correas» o «Portón telescópico».">
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={inputClass} autoFocus />}
      </Field>
      {!group && (
        <Field label="Etapas" hint={picked ? picked.stages.join(" → ") : "Elegí una plantilla."}>
          {(p) => (
            <select {...p} value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className={inputClass}>
              {active.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Footer
        busy={busy}
        onClose={onClose}
        extra={group && <Button type="button" variant="link-danger" onClick={archive} disabled={busy}>Archivar grupo</Button>}
      />
    </form>
  );
}

// ---------------------------------------------------------------- etapas de un grupo
export function StagesDialog({
  open, onClose, group, stages, stagesWithQty,
}: { open: boolean; onClose: () => void; group: CalGroup; stages: CalStage[]; stagesWithQty: string[] }) {
  return (
    <Modal open={open} onClose={onClose} title={`Etapas de «${group.name}»`}>
      <StagesForm group={group} stages={stages} stagesWithQty={stagesWithQty} onClose={onClose} />
    </Modal>
  );
}

type StageDraft = { key: string; id: string | null; name: string };

function StagesForm({ group, stages, stagesWithQty, onClose }: { group: CalGroup; stages: CalStage[]; stagesWithQty: string[]; onClose: () => void }) {
  const { router, supabase } = useRpc();
  const confirm = useConfirm();
  const [rows, setRows] = useState<StageDraft[]>(() => stages.map((s) => ({ key: s.id, id: s.id, name: s.name })));
  const [seq, setSeq] = useState(0);
  const [busy, setBusy] = useState(false);

  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const next = r.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kept = new Set(rows.map((r) => r.id).filter(Boolean));
    const lost = stages.filter((s) => !kept.has(s.id) && stagesWithQty.includes(s.id));
    if (lost.length) {
      const ok = await confirm({
        title: "Vas a perder cantidades cargadas",
        description: `Al quitar ${lost.map((s) => `«${s.name}»`).join(", ")} se borran las cantidades que tenían cargadas (también las de elementos archivados).`,
        confirmLabel: "Quitar igual",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("cal_save_group_stages", {
      p_group_id: group.id,
      p_stages: rows.map((r) => ({ id: r.id, name: r.name })),
    });
    setBusy(false);
    if (error) return notify.error("No se pudieron guardar las etapas", error.message);
    notify.success("Etapas actualizadas");
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <p className="text-sm text-slate-500">
        Se ven como columnas, en este orden. La <strong className="font-medium text-slate-900">última</strong> es la etapa final: cuando llega al total, el elemento queda completo.
      </p>
      <ol className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-500">{i + 1}</span>
            <input
              value={r.name}
              onChange={(e) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
              required
              maxLength={60}
              aria-label={`Etapa ${i + 1}`}
              className={`${inputClass} !mt-0 flex-1`}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Bajar">↓</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} disabled={rows.length === 1} aria-label="Quitar etapa">
              <IconX className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={rows.length >= 20}
        onClick={() => {
          setRows((all) => [...all, { key: `new-${seq}`, id: null, name: "" }]);
          setSeq((n) => n + 1);
        }}
      >
        Agregar etapa
      </Button>
      <Footer busy={busy} onClose={onClose} />
    </form>
  );
}

// ---------------------------------------------------------------- elemento
export function ItemDialog({ open, onClose, groupId, item }: { open: boolean; onClose: () => void; groupId: string; item?: CalItem | null }) {
  return (
    <Modal open={open} onClose={onClose} title={item ? "Editar elemento" : "Nuevo elemento"}>
      <ItemForm groupId={groupId} item={item ?? null} onClose={onClose} />
    </Modal>
  );
}

function ItemForm({ groupId, item, onClose }: { groupId: string; item: CalItem | null; onClose: () => void }) {
  const { router, supabase } = useRpc();
  const confirm = useConfirm();
  const [name, setName] = useState(item?.name ?? "");
  const [total, setTotal] = useState(item ? String(item.total) : "");
  const [due, setDue] = useState(item?.due_date ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{1,9}$/.test(total.trim())) return notify.error("El total tiene que ser un número entero de 0 en adelante");
    setBusy(true);
    const { error } = await supabase.rpc("cal_save_item", {
      p_id: item?.id ?? null,
      p_group_id: groupId,
      p_name: name,
      p_total: Number(total),
      p_due_date: due || null,
    });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar el elemento", error.message);
    notify.success(item ? "Elemento actualizado" : "Elemento creado");
    onClose();
    router.refresh();
  }

  async function archive() {
    if (!item) return;
    const ok = await confirm({
      title: `¿Archivar «${item.name}»?`,
      description: "Deja de verse en la planilla y de sumar en los totales. Su historial queda guardado.",
      confirmLabel: "Archivar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("cal_set_active", { p_entity: "item", p_id: item.id, p_active: false });
    setBusy(false);
    if (error) return notify.error("No se pudo archivar", error.message);
    notify.success("Elemento archivado");
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" hint="Por ejemplo «Columnas laterales Tramo 1-A» o «Piso de cocina».">
        {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className={inputClass} autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total a fabricar" hint="Cantidad de piezas del elemento.">
          {(p) => <input {...p} value={total} onChange={(e) => setTotal(e.target.value)} required inputMode="numeric" pattern="[0-9]*" className={`${inputClass} tabular-nums`} />}
        </Field>
        <Field label="Fecha compromiso" hint="Cuándo tiene que estar en sitio.">
          {(p) => <input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />}
        </Field>
      </div>
      <Footer
        busy={busy}
        onClose={onClose}
        extra={item && <Button type="button" variant="link-danger" onClick={archive} disabled={busy}>Archivar elemento</Button>}
      />
    </form>
  );
}
