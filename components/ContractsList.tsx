"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downloadContractsXlsx, type ContractExportRow } from "@/lib/exportContracts";
import {
  CONTRACT_DISPLAY_STATUS_COLORS,
  CONTRACT_DISPLAY_STATUS_LABELS,
  CONTRACT_ITEM_TYPE_LABELS,
  contractDisplayStatus,
  daysUntil,
  formatDateOnly,
  formatUsd,
  isRenewalAlertActive,
  noticeDeadline,
  type ContractDisplayStatus,
  type ContractItemType,
} from "@/lib/contracts";
import type { Database } from "@/lib/database.types";

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

const ALERT_WINDOW_DAYS = 60;

export default function ContractsList({
  contracts,
  items,
  rates,
  installments,
  documents,
  attendedAlerts,
  providers,
}: {
  contracts: Contract[];
  items: ContractItem[];
  rates: ContractItemRate[];
  installments: Installment[];
  documents: ContractDocument[];
  attendedAlerts: AttendedAlert[];
  providers: Provider[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ContractDisplayStatus | "">("");
  const [providerFilter, setProviderFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContractItemType | "">("");
  const [attending, setAttending] = useState<string | null>(null);

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

  const committedUsd = summaries
    .filter((s) => s.status !== "devuelto" && s.status !== "vencido")
    .reduce((sum, s) => sum + s.monthlyUsd * Math.max(0, s.remaining), 0);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Costo comprometido a futuro" value={formatUsd(committedUsd)} caption="Cuotas restantes de contratos vigentes" />
        <StatCard
          label="Contratos activos"
          value={String(summaries.filter((s) => s.status === "vigente" || s.status === "por_vencer").length)}
          caption={`${summaries.length} en total`}
        />
        <StatCard label="Avisos sin atender" value={String(totalAlerts)} caption="Vencimientos, documentos y diferencias" accent={totalAlerts > 0} />
      </div>

      {totalAlerts > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
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
                  <button
                    onClick={() => attend("renovacion", c.id)}
                    disabled={attending === `renovacion:${c.id}`}
                    className="text-xs font-medium text-amber-700 underline disabled:opacity-50"
                  >
                    Marcar atendida
                  </button>
                </li>
              );
            })}
            {documentAlerts.map((d) => (
              <li key={`doc-${d.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <Link href={d.contract_id ? `/contratos/${d.contract_id}` : "/contratos"} className="text-slate-800 hover:underline">
                  {d.file_name} vence el {formatDateOnly(d.expires_at!)}
                </Link>
                <button
                  onClick={() => attend("documento", d.id)}
                  disabled={attending === `documento:${d.id}`}
                  className="text-xs font-medium text-amber-700 underline disabled:opacity-50"
                >
                  Marcar atendida
                </button>
              </li>
            ))}
            {differenceAlerts.map((inst) => {
              const contract = contracts.find((c) => c.id === inst.contract_id);
              return (
                <li key={`dif-${inst.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                  <Link href={`/contratos/${inst.contract_id}`} className="text-slate-800 hover:underline">
                    {contract?.provider?.name ?? "Proveedor"} — cuota {formatDateOnly(inst.period_start)} con diferencia
                  </Link>
                  <button
                    onClick={() => attend("diferencia", inst.id)}
                    disabled={attending === `diferencia:${inst.id}`}
                    className="text-xs font-medium text-amber-700 underline disabled:opacity-50"
                  >
                    Marcar atendida
                  </button>
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
        <button
          type="button"
          onClick={exportToExcel}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Exportar a Excel
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No hay contratos para mostrar.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <li key={s.contract.id}>
                <Link
                  href={`/contratos/${s.contract.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
                >
                  <div className="w-20 shrink-0 text-center">
                    <p className="text-base font-bold text-slate-900">
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
                  <div className="flex items-center gap-4 text-xs">
                    <span className="hidden text-slate-500 sm:block">{formatUsd(s.monthlyUsd)}/mes</span>
                    <span className="hidden text-slate-400 md:block">
                      {formatDateOnly(s.contract.start_date)} — {formatDateOnly(s.contract.end_date)}
                    </span>
                    <span className="hidden text-slate-500 lg:block">
                      {s.paid}/{s.paid + s.remaining} cuotas
                    </span>
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${CONTRACT_DISPLAY_STATUS_COLORS[s.status]}`}
                    >
                      {CONTRACT_DISPLAY_STATUS_LABELS[s.status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, caption, accent }: { label: string; value: string; caption: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-amber-600" : "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{caption}</p>
    </div>
  );
}
