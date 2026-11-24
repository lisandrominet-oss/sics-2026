"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FileDropzone from "@/components/ui/FileDropzone";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { readCsvFile, downloadCsv } from "@/lib/csv";
import { inputClass, labelClass, numClass } from "@/lib/ui";
import { cn } from "@/lib/cn";
import {
  OBRA_CSV_TEMPLATE_HEADERS,
  parsePrimavera,
  planRange,
  type PrimaveraResult,
} from "@/lib/importPrimavera";
import { formatShortDate } from "@/lib/obras";

type ProjectOption = { id: string; name: string; code: string | null };

const PREVIEW_ROWS = 300;
const NEW_PROJECT = "__nuevo";

// "Importar desde Primavera": se suelta el .xer (o el export de actividades como CSV), se revisa el árbol
// y se crea la obra (o se carga el plan en un proyecto que ya existe y todavía no tiene plan).
export default function ImportObraModal({
  open,
  onClose,
  projectsWithoutPlan,
  fixedProjectId,
}: {
  open: boolean;
  onClose: () => void;
  /** Proyectos que ya existen y no tienen plan: se puede cargar el plan ahí en vez de crear uno nuevo. */
  projectsWithoutPlan: ProjectOption[];
  /** Si viene, el plan se carga en ese proyecto (sin elegir destino). */
  fixedProjectId?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PrimaveraResult | null>(null);
  const [projectKey, setProjectKey] = useState("");
  const [target, setTarget] = useState(fixedProjectId ?? NEW_PROJECT);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setResult(null);
    setProjectKey("");
    setTarget(fixedProjectId ?? NEW_PROJECT);
    setName("");
    setCode("");
    setError(null);
  }, [open, fixedProjectId]);

  const projects = result?.ok ? result.projects : [];
  const project = projects.find((p) => p.key === projectKey) ?? null;
  const stats = useMemo(() => {
    if (!project) return null;
    const wbs = project.nodes.filter((n) => n.kind === "wbs").length;
    return { wbs, activities: project.nodes.length - wbs, ...planRange(project.nodes) };
  }, [project]);

  function pickProject(key: string, parsed: PrimaveraResult) {
    if (!parsed.ok) return;
    const p = parsed.projects.find((x) => x.key === key);
    setProjectKey(key);
    setName(p?.name ?? "");
    setCode(p?.code ?? "");
  }

  async function readFile(f: File) {
    setFile(f);
    setError(null);
    try {
      const parsed = parsePrimavera(await readCsvFile(f), f.name);
      setResult(parsed);
      if (parsed.ok) {
        // Si el archivo trae varios proyectos (por ejemplo, líneas base), se propone el más grande.
        const biggest = [...parsed.projects].sort((a, b) => b.nodes.length - a.nodes.length)[0];
        pickProject(biggest.key, parsed);
      }
    } catch {
      setResult({ ok: false, error: "No se pudo leer el archivo. Probá exportarlo de nuevo desde Primavera." });
    }
  }

  function restart() {
    setFile(null);
    setResult(null);
    setProjectKey("");
    setError(null);
  }

  async function confirmImport() {
    if (!project || saving) return;
    if (target === NEW_PROJECT && !name.trim()) {
      setError("Poné el nombre de la obra.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("obra_import", {
      p_project_id: target === NEW_PROJECT ? null : target,
      p_project: { name: name.trim(), code: code.trim() || null },
      p_nodes: project.nodes.map(({ depth: _depth, ...n }) => n),
    });
    setSaving(false);
    if (rpcError || !data) {
      setError(rpcError?.message ?? "No se pudo importar la obra.");
      return;
    }
    notify.success("Obra importada", `${project.nodes.length} ítems cargados desde Primavera.`);
    onClose();
    router.push(`/obras/${data}`);
    router.refresh();
  }

  const preview = project?.nodes.slice(0, PREVIEW_ROWS) ?? [];

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Importar desde Primavera" className="sm:max-w-3xl">
      {!project ? (
        <div className="mt-3 space-y-4 text-sm">
          <p className="text-slate-600">
            Exportá el proyecto desde Primavera P6 y soltá el archivo acá. Sirve el <span className="text-slate-900">.xer</span> (Archivo →
            Exportar → XER) o el listado de actividades guardado como <span className="text-slate-900">CSV</span>.
          </p>
          <FileDropzone accept=".xer,.csv,.txt,text/csv,text/plain" value={file} onFile={readFile} onClear={restart} />
          {result && !result.ok && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              {result.error}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Si usás CSV, las columnas que se leen son: {OBRA_CSV_TEMPLATE_HEADERS.join(", ")}. El nivel de la WBS sale del código (A9JM.B.B1).
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <Button
              variant="link"
              size="sm"
              onClick={() => downloadCsv("plantilla-obra-primavera.csv", OBRA_CSV_TEMPLATE_HEADERS.join(";") + "\n")}
            >
              Descargar plantilla CSV
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          {result?.ok && result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              {result.warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {result.warnings.length > 5 && <li>Y {result.warnings.length - 5} avisos más.</li>}
            </ul>
          )}

          {projects.length > 1 && (
            <div>
              <label htmlFor="obra-proyecto-xer" className={labelClass}>
                Proyecto del archivo
              </label>
              <select
                id="obra-proyecto-xer"
                value={projectKey}
                onChange={(e) => result && pickProject(e.target.value, result)}
                className={inputClass}
              >
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.code ? `${p.code} · ` : ""}
                    {p.name} ({p.nodes.length} ítems)
                  </option>
                ))}
              </select>
            </div>
          )}

          {!fixedProjectId && (
            <div>
              <label htmlFor="obra-destino" className={labelClass}>
                Cargar en
              </label>
              <select id="obra-destino" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
                <option value={NEW_PROJECT}>Un proyecto nuevo</option>
                {projectsWithoutPlan.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (ya existe, sin plan)
                  </option>
                ))}
              </select>
              {target !== NEW_PROJECT && (
                <p className="mt-1 text-xs text-slate-500">Las SIC que ese proyecto ya tiene quedan como “General del proyecto” hasta que se clasifiquen.</p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            {target === NEW_PROJECT && (
              <div>
                <label htmlFor="obra-nombre" className={labelClass}>
                  Nombre de la obra
                </label>
                <input id="obra-nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
            )}
            <div className={cn(target !== NEW_PROJECT && "sm:col-span-2 sm:max-w-[12rem]")}>
              <label htmlFor="obra-codigo" className={labelClass}>
                Código
              </label>
              <input id="obra-codigo" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Opcional" className={inputClass} />
            </div>
          </div>

          {stats && (
            <p className={cn("text-slate-600", numClass)}>
              {stats.wbs} WBS · {stats.activities} actividades · {formatShortDate(stats.start)} → {formatShortDate(stats.end)}
            </p>
          )}

          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <ul className="divide-y divide-slate-100">
              {preview.map((n) => (
                <li key={n.ref} className="flex items-baseline gap-3 px-3 py-1.5" style={{ paddingLeft: `${0.75 + Math.min(n.depth, 8) * 1}rem` }}>
                  <span className={cn("shrink-0 text-xs text-slate-500", numClass)}>{n.code}</span>
                  <span className={cn("min-w-0 flex-1 truncate", n.kind === "wbs" ? "font-medium text-slate-900" : "text-slate-700")}>{n.name}</span>
                  {n.kind === "actividad" && (
                    <span className={cn("shrink-0 text-xs text-slate-500", numClass)}>
                      {formatShortDate(n.current_start)} → {formatShortDate(n.current_end)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {project.nodes.length > PREVIEW_ROWS && (
              <p className="px-3 py-2 text-xs text-slate-500">Y {project.nodes.length - PREVIEW_ROWS} ítems más.</p>
            )}
          </div>

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
              <Button onClick={confirmImport} loading={saving}>
                Importar {project.nodes.length} ítems
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
