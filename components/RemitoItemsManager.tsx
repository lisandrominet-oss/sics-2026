"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { filterClass, inputClass, numClass } from "@/lib/ui";
import {
  CAN, CATEGORY_LABELS, QUALITY_LABELS, QUALITY_TONES, fmtDateTime, fmtQty, untyped,
  type RemitoCategory, type RemitoItem, type RemitoQuality, type RemitoRole,
} from "@/lib/remitos";

const EMPTY_FORM = { code: "", description: "", rubric: "", unit: "un", category: "retornable" as RemitoCategory, stock: "0" };

export default function RemitoItemsManager({ items, role }: { items: RemitoItem[]; role: RemitoRole }) {
  const router = useRouter();
  const supabase = useMemo(() => untyped(createClient()), []);
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState<"" | RemitoQuality>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [stockFor, setStockFor] = useState<RemitoItem | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");

  const canManage = CAN.gestionarItems(role);
  const canApprove = CAN.aprobarCalidad(role);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!quality || i.quality_status === quality) &&
        (!q || i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || (i.rubric ?? "").toLowerCase().includes(q))
    );
  }, [items, search, quality]);

  async function setDecision(item: RemitoItem, decision: RemitoQuality) {
    setBusy(item.id);
    const { error } = await supabase.rpc("remito_set_item_quality", { p_item_id: item.id, p_decision: decision });
    setBusy(null);
    if (error) return notify.error("No se pudo actualizar la liberación", error.message);
    notify.success(decision === "aprobado" ? `${item.code} aprobado` : decision === "rechazado" ? `${item.code} rechazado` : `${item.code} vuelve a pendiente`);
    router.refresh();
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const { error } = await supabase.rpc("remito_create_item", {
      p_code: form.code,
      p_description: form.description,
      p_rubric: form.rubric,
      p_unit: form.unit,
      p_category: form.category,
      p_stock: Number(form.stock || 0),
    });
    setCreating(false);
    if (error) return notify.error("No se pudo crear el ítem", error.message);
    notify.success("Ítem creado, queda pendiente de Calidad");
    setForm(EMPTY_FORM);
    router.refresh();
  }

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    if (!stockFor) return;
    const delta = Number(stockQty.replace(",", "."));
    if (!delta) return notify.error("Indicá una cantidad distinta de cero");
    setBusy(stockFor.id);
    const { error } = await supabase.rpc("remito_adjust_stock", { p_item_id: stockFor.id, p_delta: delta, p_note: stockNote });
    setBusy(null);
    if (error) return notify.error("No se pudo ajustar el stock", error.message);
    notify.success("Stock actualizado");
    setStockFor(null);
    setStockQty("");
    setStockNote("");
    router.refresh();
  }

  return (
    <div className="mt-5 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, descripción o rubro"
          aria-label="Buscar ítems"
          className={`${filterClass} w-full sm:w-80`}
        />
        <select value={quality} onChange={(e) => setQuality(e.target.value as "" | RemitoQuality)} className={filterClass} aria-label="Estado de Calidad">
          <option value="">Toda la liberación</option>
          {(Object.keys(QUALITY_LABELS) as RemitoQuality[]).map((q) => <option key={q} value={q}>{QUALITY_LABELS[q]}</option>)}
        </select>
        <span className="text-sm text-slate-500">{filtered.length} de {items.length}</span>
      </div>

      <Card padding="none" className="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState title={items.length === 0 ? "Todavía no hay ítems en el catálogo" : "Ningún ítem coincide con el filtro"} />
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium">Rubro</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Calidad</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className={`px-4 py-3 font-medium text-slate-900 ${numClass}`}>{i.code}</td>
                  <td className="px-4 py-3 text-slate-700">{i.description}</td>
                  <td className="px-4 py-3 text-slate-600">{i.rubric ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[i.category]}</td>
                  <td className={`px-4 py-3 text-right text-slate-700 ${numClass}`}>{fmtQty(i.stock)} {i.unit}</td>
                  <td className="px-4 py-3">
                    <Badge tone={QUALITY_TONES[i.quality_status]} dot>{QUALITY_LABELS[i.quality_status]}</Badge>
                    {i.quality_by_name && i.quality_status !== "pendiente" && (
                      <span className="mt-1 block text-xs text-slate-500">{i.quality_by_name} · {fmtDateTime(i.quality_at)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      {canApprove && i.quality_status !== "aprobado" && (
                        <Button variant="link" size="sm" disabled={busy === i.id} onClick={() => setDecision(i, "aprobado")}>Aprobar</Button>
                      )}
                      {canApprove && i.quality_status !== "rechazado" && (
                        <Button variant="link-danger" size="sm" disabled={busy === i.id} onClick={() => setDecision(i, "rechazado")}>Rechazar</Button>
                      )}
                      {canApprove && i.quality_status !== "pendiente" && (
                        <Button variant="link" size="sm" disabled={busy === i.id} onClick={() => setDecision(i, "pendiente")}>Pendiente</Button>
                      )}
                      {canManage && (
                        <Button variant="link" size="sm" onClick={() => setStockFor(i)}>Ingresar</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {canManage && (
        <Card title="Nuevo ítem">
          <form onSubmit={createItem} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código">{(p) => <input {...p} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />}</Field>
            <Field label="Descripción" className="lg:col-span-2">{(p) => <input {...p} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />}</Field>
            <Field label="Rubro (sale impreso)">{(p) => <input {...p} value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })} className={inputClass} />}</Field>
            <Field label="Unidad">{(p) => <input {...p} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} />}</Field>
            <Field label="Categoría">
              {(p) => (
                <select {...p} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as RemitoCategory })} className={inputClass}>
                  {(Object.keys(CATEGORY_LABELS) as RemitoCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Stock inicial">{(p) => <input {...p} type="number" min="0" step="0.01" inputMode="decimal" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputClass} />}</Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <Button type="submit" loading={creating}>Crear ítem</Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">Se crea en estado Pendiente: Calidad tiene que aprobarlo antes de poder despacharlo.</p>
        </Card>
      )}

      <Modal open={stockFor !== null} onClose={() => setStockFor(null)} title={stockFor ? `Ingresar stock · ${stockFor.code}` : ""}>
        <form onSubmit={addStock} className="mt-3 space-y-4">
          <p className="text-sm text-slate-500">{stockFor?.description}. Hay {fmtQty(stockFor?.stock)} {stockFor?.unit}. Un número negativo descuenta.</p>
          <Field label="Cantidad">{(p) => <input {...p} required autoFocus type="number" step="0.01" inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className={inputClass} />}</Field>
          <Field label="Nota (opcional)">{(p) => <input {...p} value={stockNote} onChange={(e) => setStockNote(e.target.value)} className={inputClass} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setStockFor(null)}>Cancelar</Button>
            <Button type="submit" loading={busy === stockFor?.id}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
