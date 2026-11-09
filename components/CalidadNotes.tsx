"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { inputClass, numClass } from "@/lib/ui";
import { fmtShortDate, untyped, type CalNote } from "@/lib/calidad";

// Diario de novedades del sector («02/11: durante el día se realizará colocación de accesorios»).
export default function CalidadNotes({
  bayId, notes, groups, canEdit, today,
}: { bayId: string; notes: CalNote[]; groups: { id: string; name: string }[]; canEdit: boolean; today: string }) {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const confirm = useConfirm();
  const [date, setDate] = useState(today);
  const [groupId, setGroupId] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("cal_add_note", { p_bay_id: bayId, p_group_id: groupId || null, p_note_date: date || null, p_body: body });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar la novedad", error.message);
    notify.success("Novedad agregada");
    setBody("");
    router.refresh();
  }

  async function remove(n: CalNote) {
    const ok = await confirm({
      title: "¿Borrar esta novedad?",
      description: n.body,
      confirmLabel: "Borrar",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("cal_delete_note", { p_note_id: n.id });
    if (error) return notify.error("No se pudo borrar", error.message);
    notify.success("Novedad borrada");
    router.refresh();
  }

  return (
    <Card padding="none">
      <div className="px-4 pt-4 sm:px-5">
        <h3 className="text-base font-semibold text-slate-900">Novedades</h3>
        <p className="mt-0.5 text-xs text-slate-500">Lo que se habló en la reunión y lo que pasó en obra, de lo más nuevo a lo más viejo.</p>
      </div>

      {canEdit && (
        <form onSubmit={add} className="mt-3 grid gap-3 border-b border-slate-100 px-4 pb-4 sm:px-5 md:grid-cols-[10rem_14rem_1fr_auto] md:items-end">
          <Field label="Fecha">
            {(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Grupo">
            {(p) => (
              <select {...p} value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
                <option value="">Todo el sector</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Novedad">
            {(p) => <input {...p} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} placeholder="Ej.: llegó el material para el marco del portón" className={inputClass} />}
          </Field>
          <Button type="submit" loading={busy} className="md:mb-0">Agregar</Button>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">Todavía no hay novedades en este sector.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <span className={`w-16 shrink-0 pt-px text-sm text-slate-500 ${numClass}`}>{fmtShortDate(n.note_date)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 [overflow-wrap:anywhere]">{n.body}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {n.group_id ? `${groupName.get(n.group_id) ?? "Grupo"} · ` : ""}
                  {n.created_by_name ?? ""}
                </p>
              </div>
              {canEdit && (
                <Button type="button" variant="link-danger" size="sm" onClick={() => remove(n)}>Borrar</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
