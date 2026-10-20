"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FileDropzone from "@/components/ui/FileDropzone";
import { notify } from "@/lib/notify";
import {
  CSV_TEMPLATE_HEADERS,
  csvTemplate,
  csvToImportRows,
  formatCuil,
  formatDni,
  importRowError,
  readCsvFile,
  type ImportRow,
} from "@/lib/employees";

type ServerError = { row: number; message: string };
type ImportResult = { ok: boolean; created: number; updated: number; unchanged: number; errors: ServerError[] };

const PREVIEW_ROWS = 50;

function downloadTemplate() {
  const blob = new Blob([csvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-personal.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmployeeImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerError[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const localErrors = useMemo(() => (rows ?? []).map((r) => importRowError(r)), [rows]);
  const localErrorCount = localErrors.filter(Boolean).length;
  const serverErrorByRow = useMemo(() => new Map(serverErrors.map((e) => [e.row, e.message])), [serverErrors]);

  function clear() {
    setFile(null);
    setRows(null);
    setIgnored([]);
    setParseError(null);
    setServerErrors([]);
    setResult(null);
  }

  async function handleFile(f: File) {
    clear();
    setFile(f);
    try {
      const parsed = csvToImportRows(await readCsvFile(f));
      if (!parsed.ok) {
        setParseError(parsed.error);
        return;
      }
      setRows(parsed.rows);
      setIgnored(parsed.ignoredColumns);
    } catch {
      setParseError("No se pudo leer el archivo. Guardalo como CSV desde Excel y probá de nuevo.");
    }
  }

  async function submit() {
    if (!rows) return;
    setSubmitting(true);
    setServerErrors([]);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("import_employees", { p_rows: rows });
    setSubmitting(false);
    if (error) {
      notify.error("No se pudo importar", error.message);
      return;
    }
    const res = data as unknown as ImportResult;
    if (!res.ok) {
      setServerErrors(res.errors);
      notify.error("El archivo tiene errores", "No se importó nada. Corregí las filas marcadas y volvé a cargarlo.");
      return;
    }
    setResult(res);
    notify.success("Importación terminada");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card title="1. Preparar el archivo">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Una fila por empleado. Columnas obligatorias: <strong>Apellido</strong>, <strong>Nombre</strong> y <strong>DNI</strong>. Opcionales: Legajo, CUIL, Fecha de
            nacimiento, Fecha de ingreso (dd/mm/aaaa), Puesto, Categoría y Área (el nombre de un área ya cargada).
          </p>
          <p>
            Si un DNI ya existe, se actualizan los datos que vengan en el archivo; una celda vacía no borra nada. Si una sola fila tiene un error, no se
            importa ninguna.
          </p>
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            Descargar plantilla ({CSV_TEMPLATE_HEADERS.length} columnas)
          </Button>
        </div>
      </Card>

      <Card title="2. Elegir el archivo CSV">
        <FileDropzone
          accept=".csv,.txt,text/csv"
          value={file}
          onFile={handleFile}
          onClear={clear}
          disabled={submitting || result !== null}
        />
        {parseError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {parseError}
          </p>
        )}
        {ignored.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">Columnas que no se importan: {ignored.join(", ")}.</p>
        )}
      </Card>

      {rows && !result && (
        <Card title={`3. Revisar (${rows.length} ${rows.length === 1 ? "fila" : "filas"})`}>
          {localErrorCount > 0 && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {localErrorCount === 1 ? "Hay 1 fila con error." : `Hay ${localErrorCount} filas con error.`} Corregí el archivo y volvé a cargarlo.
            </p>
          )}
          {serverErrors.length > 0 && (
            <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-medium">La base rechazó el archivo (no se importó nada):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {serverErrors.slice(0, 50).map((e) => (
                  <li key={e.row}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
              {serverErrors.length > 50 && <p className="mt-1">y {serverErrors.length - 50} más.</p>}
            </div>
          )}
          <p className="mb-2 text-xs text-slate-500">
            Las filas se numeran desde la primera debajo del encabezado.
            {rows.length > PREVIEW_ROWS ? ` Se muestran las primeras ${PREVIEW_ROWS}; todas se validan.` : ""}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Apellido y nombre</th>
                  <th className="px-3 py-2 font-medium">DNI</th>
                  <th className="px-3 py-2 font-medium">CUIL</th>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {rows.slice(0, PREVIEW_ROWS).map((r, i) => {
                  const err = localErrors[i] ?? serverErrorByRow.get(i + 1) ?? null;
                  return (
                    <tr key={i} className={err ? "bg-red-50/60" : undefined}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-800">{[r.last_name, r.first_name].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-3 py-2">{r.dni ? formatDni(r.dni.replace(/\D/g, "")) : "-"}</td>
                      <td className="px-3 py-2">{r.cuil ? formatCuil(r.cuil.replace(/\D/g, "")) : "-"}</td>
                      <td className="px-3 py-2">{r.area || "-"}</td>
                      <td className={`px-3 py-2 ${err ? "text-red-700" : "text-emerald-700"}`}>{err ?? "OK"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submit} loading={submitting} disabled={localErrorCount > 0 || rows.length === 0}>
              Importar {rows.length} {rows.length === 1 ? "empleado" : "empleados"}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card title="Importación terminada">
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              <strong className="tabular-nums">{result.created}</strong> empleados nuevos
            </li>
            <li>
              <strong className="tabular-nums">{result.updated}</strong> actualizados
            </li>
            <li>
              <strong className="tabular-nums">{result.unchanged}</strong> sin cambios
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/personal" className={buttonClass()}>
              Ver el listado
            </Link>
            <Button variant="secondary" onClick={clear}>
              Importar otro archivo
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
