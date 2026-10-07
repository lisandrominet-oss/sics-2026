"use client";

import { inputClass } from "@/lib/ui";
import Button from "@/components/ui/Button";
import { MAX_SIC_ITEMS } from "@/lib/constants";

export type ItemDraft = {
  id?: string;
  description: string;
  quantity: string;
  specs: string;
  referenceLink: string;
  file: File | null;
  existingFileName?: string | null;
  existingFileId?: string | null;
  existingFilePath?: string | null;
  reviewNote?: string | null;
  requiresQualityCert: boolean;
};

export const EMPTY_ITEM: ItemDraft = {
  description: "",
  quantity: "",
  specs: "",
  referenceLink: "",
  file: null,
  requiresQualityCert: false,
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
              <Button variant="link-danger" size="sm" onClick={() => removeItem(index)}>
                Quitar
              </Button>
            )}
          </div>

          {item.reviewNote && (
            <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Observación:</span> {item.reviewNote}
            </p>
          )}

          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700">Artículo</label>
              <input
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                required
                placeholder="Ej: Rodamiento 6205-2RS"
                className={inputClass}
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
                className={inputClass}
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
              className={inputClass}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Link de referencia (opcional)
              </label>
              <input
                value={item.referenceLink}
                onChange={(e) => updateItem(index, { referenceLink: e.target.value })}
                placeholder="https://..."
                className={inputClass}
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

          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={item.requiresQualityCert}
              onChange={(e) => updateItem(index, { requiresQualityCert: e.target.checked })}
            />
            Requiere certificado de calidad
          </label>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addItem} disabled={items.length >= MAX_SIC_ITEMS}>
        Agregar artículo ({items.length}/{MAX_SIC_ITEMS})
      </Button>
    </div>
  );
}
