"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import InfoTip from "@/components/ui/InfoTip";
import FileDropzone from "@/components/ui/FileDropzone";
import type { ItemDraft } from "@/components/ItemsEditor";
import { inputClass, numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";
import { downloadCsv, readCsvFile } from "@/lib/csv";
import {
  ITEMS_TEMPLATE_HEADERS,
  itemsFromCsv,
  itemsFromPastedText,
  itemsTemplateCsv,
  type ImportItemsResult,
} from "@/lib/importItems";

// "Importar desde planilla": el operario pega las filas que copió de su Google Sheets (o sube el CSV
// descargado de ahí), elige cuáles van en esta SIC y se suman al formulario para revisarlas antes de enviar.
export default function ImportItemsModal({
  open,
  onClose,
  onImport,
  freeSlots,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (items: ItemDraft[]) => void;
  /** Cuántos artículos más entran en la SIC (tope de 50 menos los ya cargados). */
  freeSlots: number;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportItemsResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Cada vez que se abre arranca de cero (al cerrar se conserva el contenido mientras dura la salida).
  useEffect(() => {
    if (!open) return;
    setText("");
    setFile(null);
    setResult(null);
    setSelected(new Set());
  }, [open]);

  function load(parsed: ImportItemsResult) {
    setResult(parsed);
    if (!parsed.ok) {
      setSelected(new Set());
      return;
    }
    // Se marcan las filas válidas que todavía no tienen código de SIC en la planilla.
    const initial = new Set<number>();
    parsed.items.forEach((it, i) => {
      if (!it.error && !it.sicCode) initial.add(i);
    });
    setSelected(initial);
  }

  function readText() {
    if (text.trim()) load(itemsFromPastedText(text));
  }

  async function readFile(f: File) {
    setFile(f);
    try {
      load(itemsFromCsv(await readCsvFile(f)));
    } catch {
      setResult({ ok: false, error: "No se pudo leer el archivo. Descargá la planilla como CSV y probá de nuevo." });
    }
  }

  function restart() {
    setText("");
    setFile(null);
    setResult(null);
    setSelected(new Set());
  }

  const items = result?.ok ? result.items : [];
  const selectable = useMemo(() => items.flatMap((it, i) => (it.error ? [] : [i])), [items]);
  const errorCount = items.length - selectable.length;
  const loadedCount = items.filter((it) => it.sicCode).length;
  const overLimit = selected.size > freeSlots;
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i));

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function confirmImport() {
    if (selected.size === 0 || overLimit) return;
    onImport(items.filter((_, i) => selected.has(i)).map((it) => it.draft));
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar desde planilla" className="sm:max-w-2xl">
      {!result?.ok ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="text-slate-600">
            En tu planilla seleccioná las filas con el encabezado, copialas y pegalas acá. Columnas:{" "}
            <span className="text-slate-900">{ITEMS_TEMPLATE_HEADERS.join(", ")}</span>.
          </p>
          <div>
            <label htmlFor="import-items-text" className="block font-medium text-slate-900">
              Filas copiadas
            </label>
            <textarea
              id="import-items-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"Artículo\tCantidad\tUnidad…\nRodamiento 6205-2RS\t4\tun"}
              className={cn(inputClass, "resize-y")}
            />
            <Button className="mt-2 w-full sm:w-auto" onClick={readText} disabled={!text.trim()}>
              Revisar filas
            </Button>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-slate-900">O subí la planilla descargada como CSV</p>
              <InfoTip>En Google Sheets: Archivo → Descargar → Valores separados por comas (.csv).</InfoTip>
            </div>
            <FileDropzone
              className="mt-2"
              compact
              accept=".csv,.txt,text/csv"
              value={file}
              onFile={readFile}
              onClear={restart}
            />
          </div>

          {result && !result.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              {result.error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <Button variant="link" size="sm" onClick={() => downloadCsv("plantilla-articulos-sic.csv", itemsTemplateCsv())}>
              Descargar plantilla vacía
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-slate-600">
            {items.length} {items.length === 1 ? "fila" : "filas"}
            {loadedCount > 0 && ` · ${loadedCount} ya ${loadedCount === 1 ? "tiene" : "tienen"} SIC`}
            {errorCount > 0 && ` · ${errorCount} con error`}.
          </p>
          {result.ignoredColumns.length > 0 && (
            <p className="text-xs text-slate-500">No se usan estas columnas: {result.ignoredColumns.join(", ")}.</p>
          )}

          {selectable.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setSelected(allSelected ? new Set() : new Set(selectable))}
            >
              {allSelected ? "Desmarcar todas" : "Marcar todas"}
            </Button>
          )}

          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {items.map((it, i) => {
              const disabled = !!it.error;
              return (
                <li key={i}>
                  <label
                    className={cn(
                      "flex min-h-11 items-start gap-3 px-3 py-2.5",
                      disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                      checked={selected.has(i)}
                      disabled={disabled}
                      onChange={() => toggle(i)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-medium", disabled ? "text-slate-500" : "text-slate-900")}>
                        {it.draft.description || "(sin artículo)"}
                        {it.draft.quantity && (
                          <span className={cn("font-normal text-slate-600", numClass)}> × {it.draft.quantity.replace(".", ",")}</span>
                        )}
                      </span>
                      {it.draft.specs && <span className="line-clamp-2 block text-xs text-slate-500">{it.draft.specs}</span>}
                      {(it.draft.referenceLink || it.draft.requiresQualityCert) && (
                        <span className="block text-xs text-slate-500">
                          {[it.draft.referenceLink && "Con link", it.draft.requiresQualityCert && "Requiere certificado de calidad"]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      {it.warning && <span className="block text-xs text-amber-700">{it.warning}.</span>}
                      {it.error && <span className="block text-xs text-red-600">{it.error}</span>}
                      {!it.error && it.sicCode && (
                        <span className="block text-xs text-slate-500">Ya anotada como cargada: {it.sicCode}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {overLimit && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              En esta SIC entran {freeSlots} {freeSlots === 1 ? "artículo más" : "artículos más"} (máximo 50). Desmarcá algunas filas y pedilas en otra SIC.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="link" size="sm" onClick={restart}>
              Pegar otras filas
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={confirmImport} disabled={selected.size === 0 || overLimit}>
                {selected.size === 1 ? "Agregar 1 artículo" : `Agregar ${selected.size} artículos`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
