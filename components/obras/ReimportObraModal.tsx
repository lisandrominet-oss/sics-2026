"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FileDropzone from "@/components/ui/FileDropzone";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { readCsvFile } from "@/lib/csv";
import { inputClass, labelClass, numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";
import { parsePrimavera, type ObraNodeDraft, type PrimaveraResult } from "@/lib/importPrimavera";
import { daysBetween, formatRange, type ObraNode } from "@/lib/obras";

type CurrentNode = ObraNode;

type Diff = {
  added: ObraNodeDraft[];
  removed: CurrentNode[];
  moved: { node: CurrentNode; draft: ObraNodeDraft; days: number | null }[];
  reactivated: CurrentNode[];
  renamed: { node: CurrentNode; draft: ObraNodeDraft }[];
};

const key = (kind: string, ext: string) => `${kind}|${ext}`;

// Mismo criterio que obra_reimport en la base, para mostrar antes de confirmar qué va a cambiar.
function computeDiff(current: CurrentNode[], next: ObraNodeDraft[]): Diff {
  const byKey = new Map(current.map((n) => [key(n.kind, n.external_id), n]));
  const nextKeys = new Set(next.map((d) => key(d.kind, d.external_id)));
  const diff: Diff = { added: [], removed: [], moved: [], reactivated: [], renamed: [] };
  for (const d of next) {
    const n = byKey.get(key(d.kind, d.external_id));
    if (!n) {
      diff.added.push(d);
      continue;
    }
    if (!n.active) diff.reactivated.push(n);
    if (n.name !== d.name || n.code !== d.code) diff.renamed.push({ node: n, draft: d });
    // Un WBS que llega sin fechas conserva las que tenga (igual que obra_reimport).
    const keepsDates = d.kind === "wbs" && !d.current_start && !d.current_end;
    if (!keepsDates && (n.current_start !== d.current_start || n.current_end !== d.current_end)) {
      const from = n.current_end ?? n.current_start;
      const to = d.current_end ?? d.current_start;
      diff.moved.push({ node: n, draft: d, days: from && to ? daysBetween(from, to) : null });
    }
  }
  for (const n of current) {
    if (n.active && !n.external_id.startsWith("manual-") && !nextKeys.has(key(n.kind, n.external_id))) diff.removed.push(n);
  }
  diff.moved.sort((a, b) => Math.abs(b.days ?? 0) - Math.abs(a.days ?? 0));
  return diff;
}

const LIST_MAX = 40;

// "Actualizar desde Primavera": se suelta el export nuevo, se ve qué se agrega, qué se mueve y qué se da de baja,
// y se confirma con un motivo. La línea base no cambia.
export default function ReimportObraModal({
  open,
  onClose,
  projectId,
  currentNodes,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentNodes: CurrentNode[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PrimaveraResult | null>(null);
  const [projectKey, setProjectKey] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    setProjectKey("");
    setReason("");
    setError(null);
  }, [open]);

  const projects = result?.ok ? result.projects : [];
  const project = projects.find((p) => p.key === projectKey) ?? null;
  const diff = useMemo(() => (project ? computeDiff(currentNodes, project.nodes) : null), [project, currentNodes]);
  const noChanges =
    diff && !diff.added.length && !diff.removed.length && !diff.moved.length && !diff.reactivated.length && !diff.renamed.length;

  async function readFile(f: File) {
    setFile(f);
    setError(null);
    try {
      const parsed = parsePrimavera(await readCsvFile(f), f.name);
      setResult(parsed);
      if (parsed.ok) setProjectKey([...parsed.projects].sort((a, b) => b.nodes.length - a.nodes.length)[0].key);
    } catch {
      setResult({ ok: false, error: "No se pudo leer el archivo. Probá exportarlo de nuevo desde Primavera." });
    }
  }

  function restart() {
    setFile(null);
    setResult(null);
    setProjectKey("");
  }

  async function confirmUpdate() {
    if (!project || saving) return;
    if (!reason.trim()) {
      setError("Indicá el motivo de la actualización (queda en el historial).");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("obra_reimport", {
      p_project_id: projectId,
      p_nodes: project.nodes.map(({ depth: _depth, ...n }) => n),
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    notify.success("Obra actualizada desde Primavera");
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Actualizar desde Primavera" className="sm:max-w-3xl">
      {!project || !diff ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="text-slate-600">
            Soltá el export nuevo del mismo proyecto (.xer o CSV). Se compara por el código de cada WBS y actividad: lo nuevo se agrega, lo que
            ya no está se da de baja (sin borrar sus SIC) y los plazos se actualizan. La línea base no cambia.
          </p>
          <FileDropzone accept=".xer,.csv,.txt,text/csv,text/plain" value={file} onFile={readFile} onClear={restart} />
          {result && !result.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              {result.error}
            </p>
          )}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          {projects.length > 1 && (
            <div>
              <label htmlFor="reimport-proyecto" className={labelClass}>
                Proyecto del archivo
              </label>
              <select id="reimport-proyecto" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} className={inputClass}>
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.code ? `${p.code} · ` : ""}
                    {p.name} ({p.nodes.length} ítems)
                  </option>
                ))}
              </select>
            </div>
          )}

          {noChanges ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">El archivo coincide con lo cargado: no hay cambios para aplicar.</p>
          ) : (
            <>
              <p className={cn("text-slate-700", numClass)}>
                {diff.moved.length} con plazos cambiados · {diff.added.length} nuevos · {diff.removed.length} se dan de baja
                {diff.reactivated.length > 0 && ` · ${diff.reactivated.length} vuelven`}
                {diff.renamed.length > 0 && ` · ${diff.renamed.length} cambian de nombre`}
              </p>
              <div className="max-h-80 space-y-4 overflow-auto rounded-lg border border-slate-200 p-3">
                {diff.moved.length > 0 && (
                  <section>
                    <h3 className="font-medium text-slate-900">Plazos que cambian</h3>
                    <ul className="mt-1 space-y-1">
                      {diff.moved.slice(0, LIST_MAX).map(({ node, draft, days }) => (
                        <li key={node.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className={cn("text-xs text-slate-500", numClass)}>{node.code}</span>
                          <span className="min-w-0 flex-1 text-slate-700 [overflow-wrap:anywhere]">{node.name}</span>
                          <span className={cn("w-full text-xs text-slate-500 sm:w-auto", numClass)}>
                            {formatRange({ start: node.current_start, end: node.current_end })} ⇒ {formatRange({ start: draft.current_start, end: draft.current_end })}
                          </span>
                          {days !== null && days !== 0 && (
                            <span className={cn("text-xs font-medium", numClass, days > 0 ? "text-red-700" : "text-emerald-700")}>
                              {days > 0 ? `+${days}` : days} d
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {diff.moved.length > LIST_MAX && <p className="mt-1 text-xs text-slate-500">Y {diff.moved.length - LIST_MAX} más.</p>}
                  </section>
                )}
                {diff.added.length > 0 && (
                  <section>
                    <h3 className="font-medium text-slate-900">Nuevos</h3>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      {diff.added.slice(0, LIST_MAX).map((d) => (
                        <li key={d.ref}>
                          <span className={cn("mr-2 text-xs text-slate-500", numClass)}>{d.code}</span>
                          {d.name}
                        </li>
                      ))}
                    </ul>
                    {diff.added.length > LIST_MAX && <p className="mt-1 text-xs text-slate-500">Y {diff.added.length - LIST_MAX} más.</p>}
                  </section>
                )}
                {diff.renamed.length > 0 && (
                  <section>
                    <h3 className="font-medium text-slate-900">Cambian de nombre</h3>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      {diff.renamed.slice(0, LIST_MAX).map(({ node, draft }) => (
                        <li key={node.id} className="[overflow-wrap:anywhere]">
                          <span className={cn("mr-2 text-xs text-slate-500", numClass)}>{node.code}</span>
                          {node.name} ⇒ {draft.code !== node.code ? `${draft.code} ` : ""}
                          {draft.name}
                        </li>
                      ))}
                    </ul>
                    {diff.renamed.length > LIST_MAX && <p className="mt-1 text-xs text-slate-500">Y {diff.renamed.length - LIST_MAX} más.</p>}
                  </section>
                )}
                {diff.removed.length > 0 && (
                  <section>
                    <h3 className="font-medium text-slate-900">Ya no están en Primavera (se dan de baja)</h3>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      {diff.removed.slice(0, LIST_MAX).map((n) => (
                        <li key={n.id}>
                          <span className={cn("mr-2 text-xs text-slate-500", numClass)}>{n.code}</span>
                          {n.name}
                        </li>
                      ))}
                    </ul>
                    {diff.removed.length > LIST_MAX && <p className="mt-1 text-xs text-slate-500">Y {diff.removed.length - LIST_MAX} más.</p>}
                  </section>
                )}
              </div>
              <div>
                <label htmlFor="reimport-motivo" className={labelClass}>
                  Motivo
                </label>
                <input
                  id="reimport-motivo"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: actualización semanal del cronograma"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700 [overflow-wrap:anywhere]">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="link" size="sm" onClick={restart} disabled={saving}>
              Elegir otro archivo
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={confirmUpdate} loading={saving} disabled={!!noChanges}>
                Aplicar cambios
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
