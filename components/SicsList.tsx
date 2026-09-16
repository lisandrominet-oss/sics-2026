"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { IconArrowRight } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { downloadSicsXlsx, type SicExportRow } from "@/lib/exportSics";
import {
  COMPRAS_EXPORTABLE_STATUSES,
  formatAmount,
  formatDate,
  type SicStatus,
  type UserRole,
} from "@/lib/constants";

export type SicRow = {
  id: string;
  code: string;
  subject: string;
  status: SicStatus;
  currency: "ARS" | "USD";
  final_amount: number | null;
  estimated_amount: number | null;
  updated_at: string;
  needed_by_date: string | null;
  department: string | null;
  plants: { name: string; prefix: string } | null;
  project: { name: string } | null;
  requester: { full_name: string | null; email: string } | null;
};

export default function SicsList({ sics, role }: { sics: SicRow[]; role: UserRole }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canExport = role === "compras" || role === "admin";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (selected.size === 0) return;
    setExporting(true);
    setError(null);
    try {
      const supabase = createClient();
      const ids = Array.from(selected);
      const { data: items, error: itemsError } = await supabase
        .from("sic_items")
        .select("sic_id, description, quantity, specs")
        .in("sic_id", ids)
        .order("position", { ascending: true });

      if (itemsError) {
        setError(itemsError.message);
        return;
      }

      const rows: SicExportRow[] = [];
      for (const sic of sics.filter((s) => selected.has(s.id))) {
        const sicItems = (items ?? []).filter((it) => it.sic_id === sic.id);
        for (const it of sicItems) {
          rows.push({
            codigo: sic.code,
            asunto: sic.subject,
            planta: sic.plants ? `${sic.plants.name} (${sic.plants.prefix})` : "-",
            proyecto: sic.project?.name ?? "-",
            solicitante: sic.requester?.full_name ?? sic.requester?.email ?? "-",
            area: sic.department ?? "-",
            fechaNecesaria: sic.needed_by_date ? formatDate(sic.needed_by_date) : "-",
            articulo: it.description,
            cantidad: it.quantity,
            especificaciones: it.specs ?? "",
          });
        }
      }

      downloadSicsXlsx(rows, `SICs_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSelected(new Set());
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {canExport && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-6 py-3">
          <p className="text-sm text-amber-800">{selected.size} SIC(s) seleccionada(s)</p>
          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {exporting ? "Generando…" : "Exportar a Excel"}
            </button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {sics.map((sic) => {
          const exportable = canExport && COMPRAS_EXPORTABLE_STATUSES.includes(sic.status);
          return (
            <li
              key={sic.id}
              onClick={() => router.push(`/sic/${sic.id}`)}
              className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex min-w-0 items-center gap-3">
                {exportable && (
                  <input
                    type="checkbox"
                    checked={selected.has(sic.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(sic.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                    aria-label={`Seleccionar ${sic.code} para exportar`}
                  />
                )}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">
                  {sic.plants?.prefix ?? "SIC"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{sic.code}</p>
                  <p className="truncate text-xs text-slate-500">{sic.subject}</p>
                  {sic.department && <p className="truncate text-xs text-slate-400">{sic.department}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden text-xs text-slate-400 lg:block">
                  {sic.needed_by_date ? `Necesaria: ${formatDate(sic.needed_by_date)}` : ""}
                </span>
                <span className="hidden text-sm text-slate-500 sm:block">
                  {formatAmount(sic.final_amount ?? sic.estimated_amount, sic.currency)}
                </span>
                <span className="hidden text-xs text-slate-400 md:block">{formatDate(sic.updated_at)}</span>
                <StatusBadge status={sic.status} />
                <span className="flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Ver
                  <IconArrowRight />
                </span>
              </div>
            </li>
          );
        })}
        {sics.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-slate-400">No hay solicitudes para mostrar.</li>
        )}
      </ul>
    </div>
  );
}
