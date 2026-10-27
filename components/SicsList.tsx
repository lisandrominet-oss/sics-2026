"use client";

import { useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import { notify } from "@/lib/notify";
import { IconArrowRight } from "@/components/icons";
import Avatar from "@/components/ui/Avatar";
import { RecorridoTira } from "@/components/ui/Recorrido";
import { PENDING_STATUSES_BY_ROLE } from "@/lib/pendingSics";
import { NO_DEADLINE_STATUSES, deadlineText } from "@/lib/plazo";
import { numClass } from "@/lib/ui";
import { createClient } from "@/lib/supabase/client";
import { downloadSicsXlsx, type SicExportRow } from "@/lib/exportSics";
import {
  CAN_CREATE_SIC,
  CAN_SEE_AMOUNTS,
  COMPRAS_EXPORTABLE_STATUSES,
  STATUS_LABELS,
  daysUntilSqlDate,
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
  // Solo llega para quien puede ver montos (ver CAN_SEE_AMOUNTS); para el resto la consulta ni lo pide.
  finance?: { final_amount: number | null } | null;
  updated_at: string;
  needed_by_date: string | null;
  department: string | null;
  on_behalf_of: string | null;
  purchase_type: string;
  plants: { name: string; prefix: string } | null;
  project: { name: string } | null;
  requester: { full_name: string | null; email: string } | null;
};

// Marca visual de "esto te espera a vos" (borde amarillo y "Revisar"). Es conservadora a propósito: el filtro
// "Pendientes de mi acción" del Tablero (lib/pendingSics) es la fuente de verdad; acá solo se marcan los casos sin ambigüedad.
function needsMyAction(role: UserRole, status: SicStatus) {
  if (role === "area") return status === "pendiente_aprobacion_jefe";
  if (role === "gerencia") return status === "pendiente_aprobacion_gerencia";
  if (role === "compras") return (PENDING_STATUSES_BY_ROLE.compras ?? []).includes(status);
  return false;
}

export default function SicsList({ sics, role }: { sics: SicRow[]; role: UserRole }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const canExport = role === "compras" || role === "admin";
  const showAmount = CAN_SEE_AMOUNTS.includes(role);

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

  const cols = [canExport ? "1.25rem" : null, "10.5rem", "minmax(0,1fr)", "13rem", showAmount ? "6.5rem" : null, "7rem", "4.5rem"]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {canExport && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <p className="text-sm text-slate-700">
            {selected.size === 1 ? "1 SIC seleccionada" : `${selected.size} SIC seleccionadas`}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="warning" onClick={handleExport} loading={exporting}>
              {exporting ? "Generando…" : "Exportar a Excel"}
            </Button>
          </div>
        </div>
      )}
      <div>
        {/* Encabezado: solo en pantallas anchas (en celular y tablet cada fila se arma en bloque). */}
        {sics.length > 0 && (
          <div
            style={{ "--cols": cols } as React.CSSProperties}
            className="hidden items-center gap-x-4 border-b border-slate-200 px-1 py-2 text-[13px] text-slate-500 xl:grid xl:[grid-template-columns:var(--cols)]"
          >
            {canExport && <span />}
            <span>Código</span>
            <span>Asunto</span>
            <span>Dónde está</span>
            {showAmount && <span className="text-right">Monto</span>}
            <span>Se necesita</span>
            <span />
          </div>
        )}
        <ul>
          {sics.map((sic, index) => {
            const exportable = canExport && COMPRAS_EXPORTABLE_STATUSES.includes(sic.status);
            const pending = needsMyAction(role, sic.status);
            const days = sic.needed_by_date && !NO_DEADLINE_STATUSES.includes(sic.status) ? daysUntilSqlDate(sic.needed_by_date) : null;
            const urgent = days !== null && (days < 0 || (pending && days <= 2));
            const requesterName = sic.requester?.full_name ?? sic.requester?.email ?? null;
            const amount = showAmount ? formatAmount(sic.finance?.final_amount ?? null, sic.currency) : null;
            const typeBadges = (
              <>
                {sic.purchase_type === "directa" && (
                  <Badge tone="sky" size="sm">
                    Directa
                  </Badge>
                )}
                {sic.purchase_type === "cuenta_corriente" && (
                  <Badge tone="violet" size="sm">
                    Cta. cte.
                  </Badge>
                )}
              </>
            );
            const checkbox = exportable && (
              <input
                type="checkbox"
                checked={selected.has(sic.id)}
                onChange={() => toggle(sic.id)}
                className="relative z-10 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                aria-label={`Seleccionar ${sic.code} para exportar`}
              />
            );
            return (
              <li
                key={sic.id}
                style={{ animationDelay: `${Math.min(index, 5) * 30}ms`, "--cols": cols } as React.CSSProperties}
                className={`group relative animate-row-in border-b border-slate-100 px-1 py-3.5 transition-colors hover:bg-slate-50 xl:grid xl:items-center xl:gap-x-4 xl:py-2.5 xl:[grid-template-columns:var(--cols)] ${
                  pending ? "before:absolute before:inset-y-0 before:-left-1 before:w-[3px] before:bg-brand before:content-['']" : ""
                }`}
              >
                <Link
                  href={`/sic/${sic.id}`}
                  prefetch={false}
                  aria-label={`Abrir ${sic.code}: ${sic.subject}`}
                  className="absolute inset-0 z-0 focus-visible:outline-offset-[-2px]"
                />

                {/* Celular y tablet: bloque de tres líneas. */}
                <div className="flex gap-3 xl:hidden">
                  {checkbox}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900 ${numClass}`}>
                        {sic.code}
                        {typeBadges}
                      </p>
                      {sic.needed_by_date && (
                        <span className={`shrink-0 text-[13px] ${numClass} ${urgent ? "font-medium text-amber-800" : "text-slate-500"}`}>
                          Necesaria: {formatSqlDate(sic.needed_by_date)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 break-words text-sm text-slate-800" title={sic.subject}>
                      {sic.subject}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">
                      {[requesterName, sic.department].filter(Boolean).join(" · ")}
                    </p>
                    {sic.on_behalf_of && <p className="truncate text-[13px] text-amber-800">A pedido de: {sic.on_behalf_of}</p>}
                    {pending && <p className="mt-2 text-[13px] font-medium text-slate-900">Espera tu acción</p>}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <RecorridoTira status={sic.status} />
                        <span className="truncate text-[13px] text-slate-500">{STATUS_LABELS[sic.status]}</span>
                      </span>
                      {amount && <span className={`shrink-0 text-sm text-slate-700 ${numClass}`}>{amount}</span>}
                    </div>
                    <p className={`mt-1 text-xs text-slate-500 ${numClass}`}>Actualizada {formatDate(sic.updated_at)}</p>
                  </div>
                </div>

                {/* Escritorio ancho: una fila de tabla. */}
                {canExport && <span className="hidden xl:block">{checkbox}</span>}
                <p className={`hidden text-sm font-medium text-slate-900 xl:block ${numClass}`}>
                  {sic.code}
                  {pending && <span className="sr-only"> (espera tu acción)</span>}
                </p>
                <div className="hidden min-w-0 xl:block">
                  <p className="truncate text-sm text-slate-900" title={sic.subject}>
                    {sic.subject}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-slate-500">
                    {requesterName && <Avatar nombre={requesterName} className="h-5 w-5 text-[10px]" />}
                    <span className="truncate">{[requesterName, sic.department].filter(Boolean).join(" · ")}</span>
                    {typeBadges}
                  </p>
                  {sic.on_behalf_of && <p className="truncate text-[13px] text-amber-800">A pedido de: {sic.on_behalf_of}</p>}
                </div>
                <div className="hidden xl:block">
                  <RecorridoTira status={sic.status} />
                  <p className="mt-1.5 truncate text-[13px] text-slate-500" title={STATUS_LABELS[sic.status]}>
                    {STATUS_LABELS[sic.status]}
                  </p>
                  <p className={`text-xs text-slate-400 ${numClass}`}>{formatDate(sic.updated_at)}</p>
                </div>
                {showAmount && <p className={`hidden text-right text-sm text-slate-700 xl:block ${numClass}`}>{amount}</p>}
                <div className={`hidden text-sm xl:block ${numClass}`}>
                  <p className="text-slate-900">{sic.needed_by_date ? formatSqlDate(sic.needed_by_date) : ""}</p>
                  {days !== null && (
                    <p className={`text-xs ${urgent ? "font-medium text-amber-800" : "text-slate-500"}`}>{deadlineText(days)}</p>
                  )}
                </div>
                {/* pointer-events-none: el enlace de la fila cubre todo; esto es solo el dibujo de la acción. */}
                <span className="pointer-events-none hidden justify-end xl:flex">
                  {pending ? (
                    <span className={buttonClass({ size: "sm" })}>Revisar</span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-transform duration-base ease-out-expo group-hover:translate-x-0.5 group-hover:text-slate-900">
                      Ver
                      <IconArrowRight />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {sics.length === 0 && (
            <li>
              <EmptyState
                title="No hay solicitudes para mostrar"
                description="Cuando haya solicitudes que coincidan con este filtro, van a aparecer acá."
                className="!px-1"
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
    </div>
  );
}
