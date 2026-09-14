"use client";

import { MAX_SIC_ITEMS } from "@/lib/constants";

export type ItemDraft = {
  description: string;
  quantity: string;
  specs: string;
  referenceLink: string;
  file: File | null;
  existingFileName?: string | null;
};

export const EMPTY_ITEM: ItemDraft = {
  description: "",
  quantity: "",
  specs: "",
  referenceLink: "",
  file: null,
};

export default function ItemsEditor({
  items,
  onChange,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
}) {
  function updateItem(index: number, patch: Partial<ItemDraft>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    if (items.length >= MAX_SIC_ITEMS) return;
    onChange([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">
              Artículo {index + 1}
            </span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Quitar
              </button>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700">Artículo</label>
              <input
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                required
                placeholder="Ej: Rodamiento 6205-2RS"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Cantidad</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700">
              Especificaciones técnicas (opcional)
            </label>
            <textarea
              value={item.specs}
              onChange={(e) => updateItem(index, { specs: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Link de referencia (opcional)
              </label>
              <input
                value={item.referenceLink}
                onChange={(e) => updateItem(index, { referenceLink: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Archivo de referencia (opcional)
              </label>
              <input
                type="file"
                onChange={(e) => updateItem(index, { file: e.target.files?.[0] ?? null })}
                className="mt-1 w-full text-xs"
              />
              {item.existingFileName && !item.file && (
                <p className="mt-1 text-xs text-slate-400">
                  Ya subido: {item.existingFileName} (se reemplaza si elegís otro)
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        disabled={items.length >= MAX_SIC_ITEMS}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Agregar artículo ({items.length}/{MAX_SIC_ITEMS})
      </button>
    </div>
  );
}
