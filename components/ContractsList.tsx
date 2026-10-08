"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card, { cardClass } from "@/components/ui/Card";
import { notify } from "@/lib/notify";
import { downloadContractsXlsx, type ContractExportRow } from "@/lib/exportContracts";
import {
  CONTRACT_DISPLAY_STATUS_TONES,
  CONTRACT_DISPLAY_STATUS_LABELS,
  CONTRACT_ITEM_TYPE_LABELS,
  contractDisplayStatus,
  daysUntil,
  formatArs,
  formatDateOnly,
  formatUsd,
  isRenewalAlertActive,
  noticeDeadline,
  type ContractDisplayStatus,
  type ContractItemType,
} from "@/lib/contracts";
import { IconChevronDown } from "@/components/icons";
import type { Database } from "@/lib/database.types";
import { eyebrowClass } from "@/lib/ui";

type Contract = Database["public"]["Tables"]["contracts"]["Row"] & {
  provider: { name: string } | null;
  plant: { name: string; prefix: string } | null;
  project: { name: string } | null;
};
type ContractItem = Database["public"]["Tables"]["contract_items"]["Row"];
type ContractItemRate = Database["public"]["Tables"]["contract_item_rates"]["Row"];
type Installment = {
  id: string;
  contract_id: string;
  period_start: string;
  period_end: string;
  status: Database["public"]["Enums"]["contract_installment_status"];
};
type ContractDocument = {
  id: string;
  contract_id: string | null;
  provider_id: string | null;
  doc_type: string;
  expires_at: string | null;
  file_name: string;
};
type AttendedAlert = { kind: string; target_id: string };
type Provider = { id: string; name: string };
type PanelKey = "deuda" | "facturado" | "pagado";
type ProviderRow = { name: string; amount: number };
type PanelData = { title: string; rows: ProviderRow[]; total: number; format: (n: number) => string };
export type InvoiceLine = {
  contract_id: string;
  net_amount: number | null;
  invoice: { kind: Database["public"]["Enums"]["provider_invoice_kind"]; status: string } | null;
};

const ALERT_WINDOW_DAYS = 60;

export default function ContractsList({
  contracts,
  items,
  rates,
  installments,
  documents,
  attendedAlerts,
  providers,
  invoiceLines,
  contractDebts,
}: {
  contracts: Contract[];
  items: ContractItem[];
  rates: ContractItemRate[];
  installments: Installment[];
  documents: ContractDocument[];
  attendedAlerts: AttendedAlert[];
  providers: Provider[];
  invoiceLines: InvoiceLine[];
  contractDebts: { contract_id: string; remaining_usd: number }[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ContractDisplayStatus | "">("");
  const [providerFilter, setProviderFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContractItemType | "">("");
  const [attending, setAttending] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);

  const attendedSet = useMemo(() => new Set(attendedAlerts.map((a) => `${a.kind}:${a.target_id}`)), [attendedAlerts]);

  function latestRate(itemId: string): ContractItemRate | null {
    const itemRates = rates.filter((r) => r.item_id === itemId);
    if (itemRates.length === 0) return null;
    return itemRates[itemRates.length - 1];
  }

  const summaries = useMemo(() => {
    return contracts.map((c) => {
      const contractItems = items.filter((i) => i.contract_id === c.id);
      const monthlyUsd = contractItems.reduce((sum, i) => sum + (latestRate(i.id)?.monthly_rate_usd ?? 0), 0);
      const contractInstallments = installments.filter((inst) => inst.contract_id === c.id);
      const paid = contractInstallments.filter((inst) => inst.status === "pagada").length;
      const remaining = contractInstallments.length - paid;
      const status = contractDisplayStatus(c);
      return { contract: c, items: contractItems, monthlyUsd, paid, remaining, status };
    });
  }, [contracts, items, rates, installments]);

  const filtered = summaries.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (providerFilter && s.contract.provider_id !== providerFilter) return false;
    if (typeFilter && !s.items.some((i) => i.type === typeFilter)) return false;
    return true;
  });

  // Los tres cuadros se arman por proveedor (vía el contrato de cada línea/deuda).
  const providerOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contracts) map.set(c.id, c.provider?.name ?? "Sin proveedor");
    return map;
  }, [contracts]);

  const byProvider = (entries: [string, number][]): { total: number; rows: ProviderRow[] } => {
    const acc = new Map<string, number>();
    let total = 0;
    for (const [contractId, amount] of entries) {
      if (amount <= 0) continue;
      const name = providerOf.get(contractId) ?? "Sin proveedor";
      acc.set(name, (acc.get(name) ?? 0) + amount);
      total += amount;
    }
    const rows = [...acc.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    return { total, rows };
  };

  // 1. Deuda total de contratos (USD): canon exacto de todas las cuotas, pasadas y futuras, menos lo pagado.
  const debt = useMemo(
    () => byProvider(contractDebts.map((d) => [d.contract_id, Number(d.remaining_usd ?? 0)])),
    [contractDebts, providerOf]
  );

  // 2 y 3. Facturado y pagado (ARS, sin IVA) de comprobantes vigentes. Las notas de crédito ya vienen
  // con signo negativo en la línea, así que restan solas del facturado.
  const { billed, paidTotals, unpaidArs } = useMemo(() => {
    const billedByContract = new Map<string, number>();
    const paidByContract = new Map<string, number>();
    for (const line of invoiceLines) {
      if (!line.invoice || line.invoice.status !== "vigente") continue;
      const target = line.invoice.kind === "pago" ? paidByContract : billedByContract;
      target.set(line.contract_id, (target.get(line.contract_id) ?? 0) + Number(line.net_amount ?? 0));
    }
    // Facturado y no pagado: por contrato, sin que un pago de más compense la deuda de otro.
    let unpaid = 0;
    for (const [contractId, amount] of billedByContract) {
      unpaid += Math.max(0, amount - (paidByContract.get(contractId) ?? 0));
    }
    return {
      billed: byProvider([...billedByContract.entries()]),
      paidTotals: byProvider([...paidByContract.entries()]),
      unpaidArs: unpaid,
    };
  }, [invoiceLines, providerOf]);

  const panels: Record<PanelKey, PanelData> = {
    deuda: { title: "Deuda por proveedor (USD)", rows: debt.rows, total: debt.total, format: formatUsd },
    facturado: { title: "Facturado por proveedor (ARS)", rows: billed.rows, total: billed.total, format: formatArs },
    pagado: { title: "Pagado por proveedor (ARS)", rows: paidTotals.rows, total: paidTotals.total, format: formatArs },
  };
  const activePanel = openPanel ? panels[openPanel] : null;
  // Último panel mostrado: el de escritorio conserva su contenido mientras se pliega (si no, se vaciaría de golpe al cerrar).
  const lastPanel = useRef(activePanel);
  if (activePanel) lastPanel.current = activePanel;
  const desktopPanel = activePanel ?? lastPanel.current;

  const renewalAlerts = contracts.filter((c) => isRenewalAlertActive(c) && !attendedSet.has(`renovacion:${c.id}`));
  const documentAlerts = documents.filter((d) => {
    if (!d.expires_at || attendedSet.has(`documento:${d.id}`)) return false;
    const days = daysUntil(new Date(d.expires_at + "T00:00:00"));
    return days <= ALERT_WINDOW_DAYS;
  });
  const differenceAlerts = installments.filter(
    (inst) => inst.status === "con_diferencia" && !attendedSet.has(`diferencia:${inst.id}`)
  );
  const totalAlerts = renewalAlerts.length + documentAlerts.length + differenceAlerts.length;

  async function attend(kind: string, targetId: string) {
    setAttending(`${kind}:${targetId}`);
    const supabase = createClient();
    await supabase.rpc("set_contract_alert_attended", { p_kind: kind, p_target_id: targetId, p_attended: true });
    setAttending(null);
    notify.success("Alerta marcada como atendida");
    router.refresh();
  }

  function exportToExcel() {
    const rows: ContractExportRow[] = filtered.map((s) => ({
      proveedor: s.contract.provider?.name ?? "-",
      equipos: s.items.map((i) => i.description).join(", "),
      plantaProyecto: s.contract.plant ? `${s.contract.plant.name} (${s.contract.plant.prefix})` : s.contract.project?.name ?? "-",
      tarifaMensualUsd: s.monthlyUsd,
      inicio: formatDateOnly(s.contract.start_date),
      vencimiento: formatDateOnly(s.contract.end_date),
      cuotasPagadas: s.paid,
      cuotasRestantes: s.remaining,
      estado: CONTRACT_DISPLAY_STATUS_LABELS[s.status],
    }));
    downloadContractsXlsx(rows, `Contratos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_200px]">
          <PanelSlot id="money-panel-deuda" panel={panels.deuda} open={openPanel === "deuda"}>
            <MoneyCard
              controls="money-panel-deuda money-panel-desktop"
              label="Total de deuda de contratos"
              value={formatUsd(debt.total)}
              caption="Histórico y futuro, sin IVA · en USD"
              valueClass="text-red-600"
              open={openPanel === "deuda"}
              onToggle={() => setOpenPanel((p) => (p === "deuda" ? null : "deuda"))}
              expandable={debt.rows.length > 0}
            />
          </PanelSlot>
          <PanelSlot id="money-panel-facturado" panel={panels.facturado} open={openPanel === "facturado"}>
            <MoneyCard
              controls="money-panel-facturado money-panel-desktop"
              label="Total facturado por proveedores"
              value={formatArs(billed.total)}
              caption={`Sin IVA · de los cuales sin pagar: ${formatArs(unpaidArs)}`}
              open={openPanel === "facturado"}
              onToggle={() => setOpenPanel((p) => (p === "facturado" ? null : "facturado"))}
              expandable={billed.rows.length > 0}
            />
          </PanelSlot>
          <PanelSlot id="money-panel-pagado" panel={panels.pagado} open={openPanel === "pagado"}>
            <MoneyCard
              controls="money-panel-pagado money-panel-desktop"
              label="Total pagado"
              value={formatArs(paidTotals.total)}
              caption="Pagos cargados, sin IVA"
              valueClass="text-emerald-600"
              open={openPanel === "pagado"}
              onToggle={() => setOpenPanel((p) => (p === "pagado" ? null : "pagado"))}
              expandable={paidTotals.rows.length > 0}
            />
          </PanelSlot>
          <Card padding="none" className="flex flex-col justify-center divide-y divide-slate-100 px-5 py-2">
            <div className="py-3">
              <p className={eyebrowClass}>Contratos activos</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {summaries.filter((s) => s.status === "vigente" || s.status === "por_vencer").length}
                <span className="ml-1.5 text-xs font-normal text-slate-400">de {summaries.length}</span>
              </p>
            </div>
            <div className="py-3">
              <p className={eyebrowClass}>Avisos sin atender</p>
              <p className={`mt-0.5 text-lg font-semibold tabular-nums ${totalAlerts > 0 ? "text-amber-600" : "text-slate-900"}`}>{totalAlerts}</p>
            </div>
          </Card>
        </div>

        {/* Escritorio: un panel compartido debajo de la fila de tarjetas. En celular el detalle se abre debajo de cada tarjeta (PanelSlot). */}
        <CollapsibleRows id="money-panel-desktop" open={!!activePanel && activePanel.rows.length > 0} className="max-lg:hidden">
          {desktopPanel && <ProviderPanel panel={desktopPanel} />}
        </CollapsibleRows>
      </div>

      {totalAlerts > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Avisos</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {renewalAlerts.map((c) => {
              const days = daysUntil(noticeDeadline(c));
              return (
                <li key={`ren-${c.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                  <Link href={`/contratos/${c.id}`} className="text-slate-800 hover:underline">
                    {c.provider?.name ?? "Proveedor"} — fecha límite de renovación{" "}
                    {days < 0 ? `vencida hace ${-days} días` : `en ${days} días`}
                  </Link>
                  <Button variant="link" size="sm" onClick={() => attend("renovacion", c.id)} disabled={attending === `renovacion:${c.id}`}>
                    Marcar atendida
                  </Button>
                </li>
              );
            })}
            {documentAlerts.map((d) => (
              <li key={`doc-${d.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <Link href={d.contract_id ? `/contratos/${d.contract_id}` : "/contratos"} className="text-slate-800 hover:underline">
                  {d.file_name} vence el {formatDateOnly(d.expires_at!)}
                </Link>
                <Button variant="link" size="sm" onClick={() => attend("documento", d.id)} disabled={attending === `documento:${d.id}`}>
                  Marcar atendida
                </Button>
              </li>
            ))}
            {differenceAlerts.map((inst) => {
              const contract = contracts.find((c) => c.id === inst.contract_id);
              return (
                <li key={`dif-${inst.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                  <Link href={`/contratos/${inst.contract_id}`} className="text-slate-800 hover:underline">
                    {contract?.provider?.name ?? "Proveedor"} — cuota {formatDateOnly(inst.period_start)} con diferencia
                  </Link>
                  <Button variant="link" size="sm" onClick={() => attend("diferencia", inst.id)} disabled={attending === `diferencia:${inst.id}`}>
                    Marcar atendida
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractDisplayStatus | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(CONTRACT_DISPLAY_STATUS_LABELS) as ContractDisplayStatus[]).map((s) => (
              <option key={s} value={s}>
                {CONTRACT_DISPLAY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContractItemType | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los equipos</option>
            {(Object.keys(CONTRACT_ITEM_TYPE_LABELS) as ContractItemType[]).map((t) => (
              <option key={t} value={t}>
                {CONTRACT_ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={exportToExcel}>
          Exportar a Excel
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No hay contratos para mostrar" description="Probá con otro filtro o cargá un contrato nuevo." className="!border-0" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <li key={s.contract.id}>
                <Link
                  href={`/contratos/${s.contract.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
                >
                  <div className="w-20 shrink-0 text-center">
                    <p className="text-base font-semibold tabular-nums text-slate-900">
                      {s.items.map((i) => i.internal_number).filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.contract.provider?.name ?? "-"}</p>
                    <p className="truncate text-xs text-slate-500">{s.items.map((i) => i.description).join(", ")}</p>
                    <p className="truncate text-xs text-slate-400">
                      {s.contract.plant ? `${s.contract.plant.name} (${s.contract.plant.prefix})` : s.contract.project?.name ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="hidden text-slate-500 sm:block">{formatUsd(s.monthlyUsd)}/mes</span>
                    <span className="hidden text-slate-400 md:block">
                      {formatDateOnly(s.contract.start_date)} — {formatDateOnly(s.contract.end_date)}
                    </span>
                    <span className="hidden text-slate-500 lg:block">
                      {s.paid}/{s.paid + s.remaining} cuotas
                    </span>
                    <Badge tone={CONTRACT_DISPLAY_STATUS_TONES[s.status]}>{CONTRACT_DISPLAY_STATUS_LABELS[s.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CollapsibleRows({ id, open, className = "", children }: { id?: string; open: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className={`grid transition-[grid-template-rows] ease-drawer ${open ? "grid-rows-[1fr] duration-open" : "grid-rows-[0fr] duration-close"} ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function ProviderPanel({ panel }: { panel: PanelData }) {
  return (
    <Card padding="lg">
      <p className={eyebrowClass}>{panel.title}</p>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {panel.rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-4 py-2">
            <span className="truncate text-slate-700">{r.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{panel.format(r.amount)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 pt-3 text-sm font-semibold tabular-nums text-slate-900">
          <span>Total</span>
          <span>{panel.format(panel.total)}</span>
        </li>
      </ul>
    </Card>
  );
}

// Tarjeta + su detalle. En celular (< lg) el detalle se abre justo debajo de la tarjeta tocada (acordeón);
// desde lg el envoltorio desaparece (`contents`) y el detalle lo muestra el panel compartido de la fila.
function PanelSlot({ id, panel, open, children }: { id: string; panel: PanelData; open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Al abrir en celular, deja a la vista tarjeta y detalle (al cerrar el panel que estaba abierto, el contenido se corre).
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 1023px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }),
      320
    );
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div ref={ref} className="scroll-mt-20 lg:contents">
      {children}
      <div id={id} className="lg:hidden" aria-hidden={!open}>
        <CollapsibleRows open={open && panel.rows.length > 0}>
          <div className="pt-4">
            <ProviderPanel panel={panel} />
          </div>
        </CollapsibleRows>
      </div>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  caption,
  valueClass = "text-slate-900",
  open,
  onToggle,
  expandable,
  controls,
}: {
  label: string;
  value: string;
  caption: string;
  valueClass?: string;
  /** Ids de los paneles de detalle que abre la tarjeta (celular y escritorio). */
  controls: string;
  open: boolean;
  onToggle: () => void;
  expandable: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={eyebrowClass}>{label}</p>
        {expandable && (
          <IconChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ease-drawer ${open ? "rotate-180 duration-open" : "duration-close"}`} />
        )}
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{caption}</p>
    </>
  );
  if (!expandable) return <Card padding="lg">{content}</Card>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className={`${cardClass({ padding: "lg" })} block w-full text-left hover:bg-slate-50 press-soft`}
    >
      {content}
    </button>
  );
}
