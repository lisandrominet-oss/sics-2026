"use client";

import { useRef } from "react";
import { inputClass, eyebrowClass } from "@/lib/ui";
import Button from "@/components/ui/Button";
import ArticleCombobox from "@/components/ui/ArticleCombobox";
import FileDropzone from "@/components/ui/FileDropzone";
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
  catalog = [],
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  /** Nombres del catálogo de artículos, los más usados primero. Sin catálogo el campo es texto libre. */
  catalog?: string[];
}) {
  // Clave estable por tarjeta: con `key={index}`, al quitar un artículo el <input type="file"> (no controlado)
  // conservaba el archivo de la posición y la pantalla mostraba uno distinto del que se subía.
  const keysRef = useRef<string[]>([]);
  const nextKeyRef = useRef(0);
  while (keysRef.current.length < items.length) keysRef.current.push(`item-${nextKeyRef.current++}`);
  if (keysRef.current.length > items.length) keysRef.current.length = items.length;

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    if (items.length >= MAX_SIC_ITEMS) return;
    onChange([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    keysRef.current.splice(index, 1);
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={keysRef.current[index]} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className={eyebrowClass}>
              Artículo {index + 1}
            </span>
            {items.length > 1 && (
              <Button variant="link-danger" size="sm" onClick={() => removeItem(index)}>
                Quitar
              </Button>
            )}
          </div>

          {item.reviewNote && (
            <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-800 [overflow-wrap:anywhere]">
              <span className="font-semibold">Observación:</span> {item.reviewNote}
            </p>
          )}

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Artículo</label>
              <ArticleCombobox
                value={item.description}
                onChange={(description) => updateItem(index, { description })}
                catalog={catalog}
                required
                placeholder="Ej: Rodamiento 6205-2RS"
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
              className={`${inputClass} resize-y`}
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
              <FileDropzone
                compact
                value={item.file}
                onFile={(file) => updateItem(index, { file })}
                onClear={() => updateItem(index, { file: null })}
                existingFileName={item.existingFileName}
              />
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
