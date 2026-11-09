"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CalidadProgress from "@/components/CalidadProgress";
import { GroupDialog, ItemDialog, StagesDialog } from "@/components/CalidadForms";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { numClass } from "@/lib/ui";
import {
  countKey, fmtShortDate, groupProgress, timeAgo, untyped,
  type CalItem, type CalTemplate, type GroupData,
} from "@/lib/calidad";

// La planilla de un grupo: elementos en filas, etapas en columnas y fila TOTAL, como la minuta.
// El editor entra a «Cargar avance», completa las celdas y guarda todo junto.
export default function CalidadGroupTable({
  data, bayId, canEdit, today, templates,
}: { data: GroupData; bayId: string; canEdit: boolean; today: string; templates: CalTemplate[] }) {
  const { group, stages, items, counts } = data;
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const progress = useMemo(() => groupProgress(data), [data]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [itemDlg, setItemDlg] = useState<{ open: boolean; item: CalItem | null }>({ open: false, item: null });
  const [stagesOpen, setStagesOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const stagesWithQty = useMemo(
    () => stages.filter((s) => items.some((i) => (counts[countKey(i.id, s.id)] ?? 0) > 0)).map((s) => s.id),
    [stages, items, counts]
  );

  const valueOf = (itemId: string, stageId: string) => draft[countKey(itemId, stageId)] ?? String(counts[countKey(itemId, stageId)] ?? 0);

  function startEdit() {
    setDraft({});
    setEditing(true);
  }
  function cancelEdit() {
    setDraft({});
    setEditing(false);
  }

  async function save() {
    const changes: { item_id: string; stage_id: string; qty: number }[] = [];
    for (const it of items) {
      for (const st of stages) {
        const key = countKey(it.id, st.id);
        if (!(key in draft)) continue;
        const raw = draft[key].trim();
        if (raw !== "" && !/^\d{1,9}$/.test(raw)) {
          return notify.error("Cantidad inválida", `«${it.name}» en «${st.name}»: usá números enteros de 0 en adelante.`);
        }
        const qty = raw === "" ? 0 : Number(raw);
        if (qty > it.total) {
          return notify.error("Supera el total", `«${it.name}» en «${st.name}»: ${qty} es más que el total (${it.total}).`);
        }
        if (qty !== (counts[key] ?? 0)) changes.push({ item_id: it.id, stage_id: st.id, qty });
      }
    }
    if (!changes.length) {
      notify.info("No hay cambios para guardar");
      return cancelEdit();
    }
    setBusy(true);
    const { error } = await supabase.rpc("cal_save_counts", { p_group_id: group.id, p_changes: changes });
    setBusy(false);
    if (error) return notify.error("No se pudo guardar el avance", error.message);
    notify.success(changes.length === 1 ? "Avance guardado (1 cambio)" : `Avance guardado (${changes.length} cambios)`);
    cancelEdit();
    router.refresh();
  }

  // Enter baja a la misma etapa del elemento siguiente (carga rápida en la reunión).
  function onCellKey(e: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-gt="${group.id}"][data-r="${r + 1}"][data-c="${c}"]`);
    if (next) {
      next.focus();
      next.select();
    }
  }

  const finalStage = stages[stages.length - 1];

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{group.name}</h3>
            {progress.totalQty > 0 && (
              <Badge tone={progress.pct >= 100 ? "success" : "neutral"} dot>
                {progress.pct}% {finalStage ? `en «${finalStage.name}»` : ""}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500" suppressHydrationWarning>
            {progress.countedItems > 0 ? `${progress.doneItems} de ${progress.countedItems} elementos completos · ` : ""}
            actualizado {timeAgo(group.progress_at)}
            {group.progress_by_name ? ` por ${group.progress_by_name}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={busy}>Cancelar</Button>
                <Button size="sm" onClick={save} loading={busy}>Guardar avance</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => setItemDlg({ open: true, item: null })}>Nuevo elemento</Button>
                <Button size="sm" variant="secondary" onClick={() => setStagesOpen(true)}>Etapas</Button>
                <Button size="sm" variant="secondary" onClick={() => setGroupOpen(true)}>Editar grupo</Button>
                <Button size="sm" onClick={startEdit} disabled={!items.length}>Cargar avance</Button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 px-4 sm:px-5">
        <CalidadProgress pct={progress.totalQty > 0 ? progress.pct : null} label={`Avance de ${group.name}`} />
      </div>

      <div className="mt-3 overflow-x-auto">
        {items.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-slate-500 sm:px-5">
            Este grupo todavía no tiene elementos.{canEdit ? " Agregá el primero con «Nuevo elemento»." : ""}
          </p>
        ) : (
          <table className="w-full min-w-max border-t border-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th scope="col" className="sticky left-0 z-10 min-w-[9rem] border-b border-r border-slate-200 bg-sheet px-4 py-2.5 font-medium sm:px-5">Elemento</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Total</th>
                {stages.map((s) => (
                  <th key={s.id} scope="col" className="min-w-[4.5rem] max-w-[7rem] border-b border-slate-200 px-3 py-2.5 text-right font-medium">
                    {s.name}
                  </th>
                ))}
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">Compromiso</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2.5 text-right font-medium">En sitio</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, r) => {
                const overdue = !!it.due_date && !it.completed_at && it.due_date < today;
                return (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-sheet px-4 py-2 text-left font-normal text-slate-900 sm:px-5">
                      {canEdit && !editing ? (
                        <button
                          type="button"
                          onClick={() => setItemDlg({ open: true, item: it })}
                          className="text-left underline-offset-2 hover:underline"
                          title="Editar elemento"
                        >
                          {it.name}
                        </button>
                      ) : (
                        it.name
                      )}
                    </th>
                    <td className={`px-3 py-2 text-right font-medium text-slate-900 ${numClass}`}>{it.total}</td>
                    {stages.map((s, c) => {
                      const qty = counts[countKey(it.id, s.id)] ?? 0;
                      if (editing) {
                        const v = valueOf(it.id, s.id);
                        const bad = v.trim() !== "" && (!/^\d{1,9}$/.test(v.trim()) || Number(v) > it.total);
                        return (
                          <td key={s.id} className="px-2 py-1.5 text-right">
                            <input
                              data-gt={group.id}
                              data-r={r}
                              data-c={c}
                              value={v}
                              inputMode="numeric"
                              aria-label={`${it.name}, ${s.name}`}
                              aria-invalid={bad || undefined}
                              onChange={(e) => setDraft((d) => ({ ...d, [countKey(it.id, s.id)]: e.target.value }))}
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) => onCellKey(e, r, c)}
                              className={`min-h-11 w-16 rounded-md border px-2 py-1 text-right text-sm sm:min-h-8 ${numClass} ${bad ? "border-red-400 text-red-700" : "border-slate-300"}`}
                            />
                          </td>
                        );
                      }
                      const done = it.total > 0 && qty >= it.total;
                      return (
                        <td
                          key={s.id}
                          className={`px-3 py-2 text-right ${numClass} ${done ? "font-medium text-emerald-700" : qty === 0 ? "text-slate-400" : "text-slate-900"}`}
                        >
                          {qty === 0 ? "–" : qty}
                        </td>
                      );
                    })}
                    <td className={`whitespace-nowrap px-3 py-2 text-right ${numClass} ${overdue ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {fmtShortDate(it.due_date)}
                      {overdue && <span className="sr-only"> (vencida)</span>}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right ${numClass} ${it.completed_at ? "text-emerald-700" : "text-slate-400"}`}>
                      {it.completed_at ? fmtShortDate(it.completed_at) : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <th scope="row" className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-left sm:px-5">TOTAL</th>
                <td className={`px-3 py-2.5 text-right ${numClass}`}>{progress.totalQty}</td>
                {stages.map((s) => (
                  <td key={s.id} className={`px-3 py-2.5 text-right ${numClass}`}>{progress.byStage.get(s.id) ?? 0}</td>
                ))}
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      {editing && (
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
          Escribí las cantidades acumuladas de cada etapa (no pueden superar el total). Con Enter pasás al elemento de abajo.
        </p>
      )}

      {canEdit && (
        <>
          <ItemDialog open={itemDlg.open} onClose={() => setItemDlg((d) => ({ ...d, open: false }))} groupId={group.id} item={itemDlg.item} />
          <StagesDialog open={stagesOpen} onClose={() => setStagesOpen(false)} group={group} stages={stages} stagesWithQty={stagesWithQty} />
          <GroupDialog open={groupOpen} onClose={() => setGroupOpen(false)} bayId={bayId} group={group} templates={templates} />
        </>
      )}
    </Card>
  );
}
