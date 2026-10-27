"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { IconSearch } from "@/components/icons";
import { notify } from "@/lib/notify";
import { formatDateOnly } from "@/lib/contracts";
import { downloadEmployeesXlsx } from "@/lib/exportEmployees";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONES,
  employeeName,
  formatCuil,
  formatDni,
  type EmployeeStatus,
  type EmployeeWithPlant,
} from "@/lib/employees";
import { inputClass } from "@/lib/ui";

type Plant = { id: string; name: string; prefix: string };
type View = "activos" | "bajas";

const PAGE_SIZE = 100;

// Sin tildes ni mayúsculas, para que "perez" encuentre "Pérez".
function fold(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function EmployeesList({ employees, plants }: { employees: EmployeeWithPlant[]; plants: Plant[] }) {
  const [view, setView] = useState<View>("activos");
  const [query, setQuery] = useState("");
  const [plantFilter, setPlantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "activo" | "licencia">("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);

  const inBaja = (e: EmployeeWithPlant) => e.status === "baja";
  const activeCount = employees.filter((e) => !inBaja(e)).length;
  const bajaCount = employees.length - activeCount;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const qDigits = query.replace(/\D/g, "");
    return employees.filter((e) => {
      if (inBaja(e) !== (view === "bajas")) return false;
      if (view === "activos" && statusFilter && e.status !== statusFilter) return false;
      if (plantFilter === "none" ? e.plant_id !== null : plantFilter && e.plant_id !== plantFilter) return false;
      if (!q) return true;
      const haystack = fold(`${e.last_name} ${e.first_name} ${e.legajo ?? ""} ${e.position ?? ""} ${e.job_category ?? ""}`);
      return haystack.includes(q) || (qDigits.length >= 3 && (e.dni.includes(qDigits) || (e.cuil ?? "").includes(qDigits)));
    });
  }, [employees, view, query, plantFilter, statusFilter]);

  const shown = filtered.slice(0, limit);

  function resetLimit() {
    setLimit(PAGE_SIZE);
  }

  async function exportToExcel() {
    setExporting(true);
    try {
      // Primero se deja constancia en la auditoría: sin registro no se exporta.
      const supabase = createClient();
      const { error } = await supabase.rpc("log_employee_export", { p_count: filtered.length });
      if (error) {
        notify.error("No se pudo exportar", error.message);
        return;
      }
      await downloadEmployeesXlsx(
        filtered.map((e) => ({
          legajo: e.legajo ?? "",
          apellido: e.last_name,
          nombre: e.first_name,
          dni: e.dni,
          cuil: e.cuil ?? "",
          nacimiento: e.birth_date ? formatDateOnly(e.birth_date) : "",
          ingreso: e.hire_date ? formatDateOnly(e.hire_date) : "",
          baja: e.termination_date ? formatDateOnly(e.termination_date) : "",
          estado: EMPLOYEE_STATUS_LABELS[e.status as EmployeeStatus] ?? e.status,
          puesto: e.position ?? "",
          categoria: e.job_category ?? "",
          area: e.plant?.name ?? "",
        })),
        `Personal_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch {
      notify.error("No se pudo exportar", "No se pudo cargar el generador de Excel. Revisá la conexión y probá de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  if (employees.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay empleados cargados"
        description="Podés importar el padrón completo desde un archivo CSV o cargar el primer empleado a mano."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/personal/importar" className="text-sm font-medium text-slate-900 underline underline-offset-2 hover:no-underline">
              Importar desde CSV
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/personal/nuevo" className="text-sm font-medium text-slate-900 underline underline-offset-2 hover:no-underline">
              Cargar un empleado
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Personal" className="flex gap-6 border-b border-slate-200">
        <ViewTab active={view === "activos"} label="Activos" count={activeCount} onClick={() => { setView("activos"); resetLimit(); }} />
        <ViewTab active={view === "bajas"} label="Bajas" count={bajaCount} onClick={() => { setView("bajas"); resetLimit(); }} />
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetLimit(); }}
              placeholder="Buscar por nombre, DNI, legajo o puesto"
              aria-label="Buscar empleados"
              className={`${inputClass} !mt-0 pl-9`}
            />
          </div>
          <select
            value={plantFilter}
            onChange={(e) => { setPlantFilter(e.target.value); resetLimit(); }}
            aria-label="Filtrar por área"
            className="w-full max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto sm:max-w-xs"
          >
            <option value="">Todas las áreas</option>
            <option value="none">Sin área</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {view === "activos" && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as "" | "activo" | "licencia"); resetLimit(); }}
              aria-label="Filtrar por estado"
              className="w-full max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto sm:max-w-xs"
            >
              <option value="">Activos y en licencia</option>
              <option value="activo">Solo activos</option>
              <option value="licencia">Solo en licencia</option>
            </select>
          )}
        </div>
        <Button variant="secondary" onClick={exportToExcel} loading={exporting} disabled={filtered.length === 0}>
          Exportar a Excel
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No hay empleados para mostrar"
            description="Probá con otra búsqueda o cambiá los filtros."
            className="!border-0"
          />
        ) : (
          <>
            <p className="border-b border-slate-100 px-6 py-2 text-xs text-slate-500 tabular-nums" aria-live="polite">
              {filtered.length === 1 ? "1 empleado" : `${filtered.length} empleados`}
            </p>
            <ul className="divide-y divide-slate-100">
              {shown.map((e) => (
                <li key={e.id}>
                  <Link href={`/personal/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1 basis-[12rem]">
                      <p className="truncate text-sm font-semibold text-slate-900" title={employeeName(e)}>
                        {employeeName(e)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[e.position, e.job_category].filter(Boolean).join(" · ") || "Sin puesto"}
                        {e.plant ? ` · ${e.plant.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs tabular-nums text-slate-500">
                      <span className="hidden sm:block">DNI {formatDni(e.dni)}</span>
                      <span className="hidden lg:block">{e.cuil ? `CUIL ${formatCuil(e.cuil)}` : ""}</span>
                      <span className="hidden w-16 text-right md:block">{e.legajo ? `Leg. ${e.legajo}` : ""}</span>
                      <Badge tone={EMPLOYEE_STATUS_TONES[e.status as EmployeeStatus] ?? "neutral"}>
                        {EMPLOYEE_STATUS_LABELS[e.status as EmployeeStatus] ?? e.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {filtered.length > shown.length && (
              <div className="border-t border-slate-100 p-3 text-center">
                <Button variant="link" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  Mostrar más ({filtered.length - shown.length} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ViewTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors duration-fast ease-out-expo ${
        active ? "border-ink font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
      <span className="font-normal tabular-nums text-slate-500">
        {count}
      </span>
    </button>
  );
}
