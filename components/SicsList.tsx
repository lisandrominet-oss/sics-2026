"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { IconArrowRight } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { downloadSicsXlsx, type SicExportRow } from "@/lib/exportSics";
import {
  CAN_CREATE_SIC,
  COMPRAS_EXPORTABLE_STATUSES,
  formatAmount,
  formatDate,
  formatSqlDate,
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
  on_behalf_of: string | null;
  purchase_type: string;
  plants: { name: string; prefix: string } | null;
  project: { name: string } | null;
  requester: { full_name: string | null; email: string } | null;
};

export default function SicsList({ sics, role }: { sics: SicRow[]; role: UserRole }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
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
    try {
      const supabase = createClient();
      const ids = Array.from(selected);
      const { data: items, error: itemsError } = await supabase
        .from("sic_items")
        .select("sic_id, description, quantity, specs")
        .in("sic_id", ids)
        .order("position", { ascending: true });

      if (itemsError) {
        notify.error("No se pudo exportar", itemsError.message);
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
            fechaNecesaria: sic.needed_by_date ? formatSqlDate(sic.needed_by_date) : "-",
            articulo: it.description,
            cantidad: it.quantity,
            especificaciones: it.specs ?? "",
          });
        }
      }

      await downloadSicsXlsx(rows, `SICs_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSelected(new Set());
    } catch {
      notify.error("No se pudo exportar", "No se pudo generar el Excel. Revisá la conexión y probá de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {canExport && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-6 py-3">
          <p className="text-sm text-amber-800">
            {selected.size === 1 ? "1 SIC seleccionada" : `${selected.size} SIC seleccionadas`}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="warning" onClick={handleExport} loading={exporting}>
              {exporting ? "Generando…" : "Exportar a Excel"}
            </Button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {sics.map((sic, index) => {
          const exportable = canExport && COMPRAS_EXPORTABLE_STATUSES.includes(sic.status);
          return (
            <li
              key={sic.id}
              style={{ animationDelay: `${Math.min(index, 5) * 30}ms` }}
              className="group relative flex animate-row-in flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50"
            >
              <Link
                href={`/sic/${sic.id}`}
                prefetch={false}
                aria-label={`Abrir ${sic.code}: ${sic.subject}`}
                className="absolute inset-0 z-0 focus-visible:outline-offset-[-2px]"
              />
              <div className="flex min-w-0 items-center gap-3">
                {exportable && (
                  <input
                    type="checkbox"
                    checked={selected.has(sic.id)}
                    onChange={() => toggle(sic.id)}
                    className="relative z-10 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600"
                    aria-label={`Seleccionar ${sic.code} para exportar`}
                  />
                )}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {sic.plants?.prefix ?? "SIC"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tabular-nums text-slate-900">
                    {sic.code}
                    {sic.purchase_type === "directa" && (
                      <Badge tone="sky" size="sm" className="ml-2">
                        Directa
                      </Badge>
                    )}
                    {sic.purchase_type === "cuenta_corriente" && (
                      <Badge tone="violet" size="sm" className="ml-2">
                        Cta. cte.
                      </Badge>
                    )}
                  </p>
                  <p className="line-clamp-2 break-words text-xs text-slate-500" title={sic.subject}>
                    {sic.subject}
                  </p>
                  {sic.department && <p className="truncate text-xs text-slate-400">{sic.department}</p>}
                  {sic.on_behalf_of && (
                    <p className="truncate text-xs text-amber-600">A pedido de: {sic.on_behalf_of}</p>
                  )}
                  {/* En pantallas angostas el monto y la fecha pasan debajo (a la derecha no entran). */}
                  <p className="text-xs tabular-nums text-slate-500 sm:hidden">
                    {formatAmount(sic.final_amount ?? sic.estimated_amount, sic.currency)}
                    {sic.needed_by_date ? ` · Necesaria: ${formatSqlDate(sic.needed_by_date)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2 tabular-nums">
                <span className="hidden text-xs text-slate-400 lg:block">
                  {sic.needed_by_date ? `Necesaria: ${formatSqlDate(sic.needed_by_date)}` : ""}
                </span>
                <span className="hidden text-sm text-slate-500 sm:block">
                  {formatAmount(sic.final_amount ?? sic.estimated_amount, sic.currency)}
                </span>
                <span className="hidden text-xs text-slate-400 md:block">{formatDate(sic.updated_at)}</span>
                <StatusBadge status={sic.status} />
                {/* pointer-events-none: al moverse en hover (transform) el span queda sobre el link de la fila y se comería el clic. */}
                <span className="pointer-events-none flex items-center gap-1 text-sm font-medium text-indigo-600 transition-transform duration-base ease-out-expo group-hover:translate-x-0.5">
                  Ver
                  <IconArrowRight />
                </span>
              </div>
            </li>
          );
        })}
        {sics.length === 0 && (
          <li>
            <EmptyState
              title="No hay solicitudes para mostrar"
              description="Cuando haya solicitudes que coincidan con este filtro, van a aparecer acá."
              className="!border-0"
              action={
                CAN_CREATE_SIC.includes(role) ? (
                  <Link href="/sic/nueva" className={buttonClass()}>
                    Crear una SIC
                  </Link>
                ) : undefined
              }
            />
          </li>
        )}
      </ul>
    </div>
  );
}
