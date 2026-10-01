"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FilePreview from "@/components/FilePreview";
import { IconChevronDown, IconFileText, IconReceipt } from "@/components/icons";
import {
  CONTRACT_DISPLAY_STATUS_COLORS,
  CONTRACT_DISPLAY_STATUS_LABELS,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  CONTRACT_INSTALLMENT_STATUS_COLORS,
  CONTRACT_INSTALLMENT_STATUS_LABELS,
  CONTRACT_ITEM_TYPE_LABELS,
  CONTRACT_RENEWAL_TYPE_LABELS,
  PROVIDER_INVOICE_KIND_LABELS,
  contractDisplayStatus,
  formatArs,
  formatDateOnly,
  formatUsd,
  type ContractDocumentType,
  type ContractRenewalType,
  type ProviderInvoiceKind,
} from "@/lib/contracts";
import type { Database } from "@/lib/database.types";

type Contract = Database["public"]["Tables"]["contracts"]["Row"] & {
  provider: { id: string; name: string; email: string | null; phone: string | null } | null;
  plant: { name: string; prefix: string } | null;
  project: { name: string } | null;
  owner: { full_name: string | null } | null;
};
type ContractItem = Database["public"]["Tables"]["contract_items"]["Row"];
type ContractItemRate = Database["public"]["Tables"]["contract_item_rates"]["Row"];
type ContractUsage = Database["public"]["Tables"]["contract_usage"]["Row"];
type Installment = Database["public"]["Tables"]["contract_installments"]["Row"];
type ContractDocument = Database["public"]["Tables"]["contract_documents"]["Row"] & { url: string | null };
type ContractEvent = Database["public"]["Tables"]["contract_events"]["Row"] & {
  actor: { full_name: string | null } | null;
};
type ProviderInvoice = Database["public"]["Tables"]["provider_invoices"]["Row"];
type InvoiceLine = Database["public"]["Tables"]["provider_invoice_lines"]["Row"] & { invoice: ProviderInvoice };

type Tab = "datos" | "items" | "documentos" | "cuotas" | "historial";

export default function ContractDetail({
  contract,
  items,
  rates,
  usage,
  installments,
  expectedByPeriod,
  documents,
  events,
  invoiceLines,
  providerInvoices,
  payments,
  invoiceFileUrls,
}: {
  contract: Contract;
  items: ContractItem[];
  rates: ContractItemRate[];
  usage: ContractUsage[];
  installments: Installment[];
  expectedByPeriod: Record<string, number>;
  documents: ContractDocument[];
  events: ContractEvent[];
  invoiceLines: InvoiceLine[];
  providerInvoices: ProviderInvoice[];
  payments: ProviderInvoice[];
  invoiceFileUrls: Record<string, string | null>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("datos");
  const [error, setError] = useState<string | null>(null);
  const status = contractDisplayStatus(contract);

  function refresh() {
    router.refresh();
  }

  const paid = installments.filter((i) => i.status === "pagada").length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {contract.provider?.name ?? "Proveedor"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {items.map((i) => i.description).join(", ") || "Contrato"}
          </h1>
        </div>
        <span
          className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${CONTRACT_DISPLAY_STATUS_COLORS[status]}`}
        >
          {CONTRACT_DISPLAY_STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-4">
        <Info label="Inicio" value={formatDateOnly(contract.start_date)} />
        <Info label="Vencimiento" value={formatDateOnly(contract.end_date)} />
        <Info label="Cuotas" value={`${paid}/${installments.length} pagadas`} />
        <Info label="Responsable" value={contract.owner?.full_name ?? "-"} />
      </div>

      <div className="mt-6 flex gap-2 border-b border-slate-200 text-sm">
        {(
          [
            ["datos", "Datos"],
            ["items", "Ítems y tarifas"],
            ["documentos", "Documentos"],
            ["cuotas", "Cuotas"],
            ["historial", "Historial"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-3 py-2 font-medium ${
              tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        {tab === "datos" && <DatosTab contract={contract} onDone={refresh} onError={setError} />}
        {tab === "items" && (
          <ItemsTab contractId={contract.id} items={items} rates={rates} usage={usage} installments={installments} onDone={refresh} onError={setError} />
        )}
        {tab === "documentos" && (
          <DocumentosTab contractId={contract.id} documents={documents} onDone={refresh} onError={setError} />
        )}
        {tab === "cuotas" && (
          <CuotasTab
            contract={contract}
            installments={installments}
            expectedByPeriod={expectedByPeriod}
            invoiceLines={invoiceLines}
            providerInvoices={providerInvoices}
            payments={payments}
            invoiceFileUrls={invoiceFileUrls}
            items={items}
            onDone={refresh}
            onError={setError}
          />
        )}
        {tab === "historial" && <HistorialTab events={events} />}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="text-slate-700">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </div>
  );
}

function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="col-span-full grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="py-3">{open ? children : null}</div>
      </div>
    </div>
  );
}

// ---------- Datos ----------

function DatosTab({
  contract,
  onDone,
  onError,
}: {
  contract: Contract;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [renewOpen, setRenewOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card title="Detalle">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Planta" value={contract.plant ? `${contract.plant.name} (${contract.plant.prefix})` : "-"} />
          <Info label="Proyecto" value={contract.project?.name ?? "-"} />
          <Info label="Contacto proveedor" value={contract.provider?.email ?? contract.provider?.phone ?? "-"} />
          <Info label="Renovación" value={CONTRACT_RENEWAL_TYPE_LABELS[contract.renewal_type]} />
          <Info label="Días de preaviso" value={String(contract.notice_days)} />
          <Info label="Plazo de renovación" value={contract.renewal_months ? `${contract.renewal_months} meses` : "-"} />
        </div>
        {contract.notes && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{contract.notes}</p>
        )}
        {contract.returned && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-emerald-700">
            Devuelto el {contract.returned_at ? formatDateOnly(contract.returned_at) : "-"}
            {contract.return_note ? ` — ${contract.return_note}` : ""}
          </p>
        )}
      </Card>

      {!contract.returned && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setEditOpen((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {editOpen ? "Cancelar" : "Editar contrato"}
          </button>
          <button
            onClick={() => setRenewOpen((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {renewOpen ? "Cancelar" : "Renovar"}
          </button>
          <button
            onClick={() => setReturnOpen((v) => !v)}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            {returnOpen ? "Cancelar" : "Devolver equipo y finalizar contrato"}
          </button>
        </div>
      )}

      {editOpen && (
        <EditContractForm
          contract={contract}
          onDone={() => { setEditOpen(false); onDone(); }}
          onError={onError}
        />
      )}
      {renewOpen && <RenewForm contractId={contract.id} onDone={() => { setRenewOpen(false); onDone(); }} onError={onError} />}
      {returnOpen && <ReturnForm contractId={contract.id} onDone={() => { setReturnOpen(false); onDone(); }} onError={onError} />}
    </div>
  );
}

function EditContractForm({
  contract,
  onDone,
  onError,
}: {
  contract: Contract;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [startDate, setStartDate] = useState(contract.start_date);
  const [endDate, setEndDate] = useState(contract.end_date);
  const [renewalType, setRenewalType] = useState<ContractRenewalType>(contract.renewal_type);
  const [renewalMonths, setRenewalMonths] = useState(contract.renewal_months ? String(contract.renewal_months) : "");
  const [noticeDays, setNoticeDays] = useState(String(contract.notice_days));
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_contract", {
      p_contract_id: contract.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_renewal_type: renewalType,
      p_renewal_months: renewalMonths ? Number(renewalMonths) : null,
      p_notice_days: Number(noticeDays || 0),
      p_notes: notes || null,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <Card title="Editar contrato">
      <p className="text-xs text-slate-500">
        Las fechas solo se pueden cambiar si el contrato todavía no tiene documentos ni cuotas facturadas. Si ya
        tiene datos cargados, usá "Renovar" para extenderlo o "Devolver equipo" para terminarlo antes.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Inicio</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Vencimiento</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Renovación</label>
          <select
            value={renewalType}
            onChange={(e) => setRenewalType(e.target.value as ContractRenewalType)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {(Object.keys(CONTRACT_RENEWAL_TYPE_LABELS) as ContractRenewalType[]).map((t) => (
              <option key={t} value={t}>{CONTRACT_RENEWAL_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Plazo renovación (meses)</label>
          <input type="number" min="0" value={renewalMonths} onChange={(e) => setRenewalMonths(e.target.value)} disabled={renewalType === "sin_renovacion"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Días de preaviso</label>
          <input type="number" min="0" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} disabled={renewalType === "sin_renovacion"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700">Notas (opcional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button onClick={submit} disabled={loading} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Guardar cambios"}
      </button>
    </Card>
  );
}

function RenewForm({ contractId, onDone, onError }: { contractId: string; onDone: () => void; onError: (e: string | null) => void }) {
  const [newEndDate, setNewEndDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("renew_contract", { p_contract_id: contractId, p_new_end_date: newEndDate, p_note: note || null });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <Card title="Renovar contrato">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Nuevo vencimiento</label>
          <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Nota (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button onClick={submit} disabled={loading || !newEndDate} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Confirmar renovación"}
      </button>
    </Card>
  );
}

function ReturnForm({ contractId, onDone, onError }: { contractId: string; onDone: () => void; onError: (e: string | null) => void }) {
  const [returnDate, setReturnDate] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!file) { onError("Hace falta adjuntar el acta de devolución"); return; }
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const path = `${contractId}/acta_devolucion/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) { setLoading(false); onError(upErr.message); return; }
    const { error } = await supabase.rpc("return_contract", {
      p_contract_id: contractId,
      p_return_date: returnDate,
      p_note: note || null,
      p_act_storage_path: path,
      p_act_file_name: file.name,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <Card title="Devolver equipo y finalizar contrato">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Fecha de devolución</label>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Acta de devolución (obligatoria)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700">Nota (opcional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <p className="mt-2 text-xs text-slate-500">Esto cancela las cuotas futuras que todavía no fueron facturadas.</p>
      <button onClick={submit} disabled={loading || !returnDate || !file} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Confirmar devolución"}
      </button>
    </Card>
  );
}

// ---------- Ítems y tarifas ----------

function ItemsTab({
  contractId,
  items,
  rates,
  usage,
  installments,
  onDone,
  onError,
}: {
  contractId: string;
  items: ContractItem[];
  rates: ContractItemRate[];
  usage: ContractUsage[];
  installments: Installment[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          rates={rates.filter((r) => r.item_id === item.id).sort((a, b) => b.valid_from.localeCompare(a.valid_from))}
          usage={usage.filter((u) => u.item_id === item.id).sort((a, b) => b.period_start.localeCompare(a.period_start))}
          installments={installments}
          onDone={onDone}
          onError={onError}
        />
      ))}
    </div>
  );
}

function ItemCard({
  item,
  rates,
  usage,
  installments,
  onDone,
  onError,
}: {
  item: ContractItem;
  rates: ContractItemRate[];
  usage: ContractUsage[];
  installments: Installment[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [rateFormOpen, setRateFormOpen] = useState(false);
  const [usageFormOpen, setUsageFormOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const current = rates[0];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {CONTRACT_ITEM_TYPE_LABELS[item.type]} — {item.description}
          </p>
          {item.identifier && <p className="text-xs text-slate-500">{item.identifier}</p>}
          {(item.chassis_number || item.domain || item.engine_number) && (
            <p className="text-xs text-slate-500">
              {[
                item.chassis_number && `Chasis: ${item.chassis_number}`,
                item.domain && `Dominio: ${item.domain}`,
                item.engine_number && `Motor: ${item.engine_number}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditItemOpen((v) => !v)} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            {editItemOpen ? "Cancelar" : "Editar equipo"}
          </button>
          <button onClick={() => setUsageFormOpen((v) => !v)} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Cargar horas del mes
          </button>
          <button onClick={() => setRateFormOpen((v) => !v)} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Ajustar tarifa
          </button>
        </div>
      </div>

      {editItemOpen && (
        <EditItemForm
          item={item}
          onDone={() => { setEditItemOpen(false); onDone(); }}
          onError={onError}
        />
      )}

      <InternalNumberField item={item} onDone={onDone} onError={onError} />

      {current && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Tarifa mensual" value={formatUsd(current.monthly_rate_usd)} />
          <Info label="Horas incluidas" value={current.included_hours ? String(current.included_hours) : "-"} />
          <Info label="Hora excedida" value={current.overage_rate_usd ? formatUsd(current.overage_rate_usd) : "-"} />
          <Info label="Regla" value={current.excess_rule === "manual" ? "Manual" : "Franquicia + hora excedida"} />
        </div>
      )}

      {rates.length > 1 && (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer">Historial de tarifas ({rates.length})</summary>
          <ul className="mt-2 space-y-1">
            {rates.map((r) => (
              <li key={r.id}>
                Desde {formatDateOnly(r.valid_from)}: {formatUsd(r.monthly_rate_usd)}/mes
                {r.included_hours ? `, ${r.included_hours} hs incluidas` : ""}
                {r.overage_rate_usd ? `, ${formatUsd(r.overage_rate_usd)}/hora excedida` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {usage.length > 0 && (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer">Horas cargadas ({usage.length})</summary>
          <ul className="mt-2 space-y-1">
            {usage.map((u) => (
              <li key={u.id}>
                {formatDateOnly(u.period_start)}: {u.hours} hs
                {u.report_file_name ? ` — ${u.report_file_name}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {rateFormOpen && (
        <RateForm
          itemId={item.id}
          onDone={() => { setRateFormOpen(false); onDone(); }}
          onError={onError}
        />
      )}
      {usageFormOpen && (
        <UsageForm
          itemId={item.id}
          installments={installments}
          onDone={() => { setUsageFormOpen(false); onDone(); }}
          onError={onError}
        />
      )}
    </Card>
  );
}

function EditItemForm({
  item,
  onDone,
  onError,
}: {
  item: ContractItem;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [description, setDescription] = useState(item.description);
  const [identifier, setIdentifier] = useState(item.identifier ?? "");
  const [chassisNumber, setChassisNumber] = useState(item.chassis_number ?? "");
  const [domain, setDomain] = useState(item.domain ?? "");
  const [engineNumber, setEngineNumber] = useState(item.engine_number ?? "");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_contract_item", {
      p_item_id: item.id,
      p_description: description,
      p_identifier: identifier || null,
      p_chassis_number: chassisNumber || null,
      p_domain: domain || null,
      p_engine_number: engineNumber || null,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  const showVehicleFields = item.type === "maquina" || item.type === "camioneta";

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700">Editar datos del equipo</p>
      <div className="mt-2">
        <label className="block text-xs font-medium text-slate-700">Descripción</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="mt-2">
        <label className="block text-xs font-medium text-slate-700">Número de serie / identificador</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      {showVehicleFields && (
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">N° de chasis</label>
            <input value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Dominio</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">N° de motor</label>
            <input value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
      )}
      <button onClick={submit} disabled={loading || !description} className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

function InternalNumberField({
  item,
  onDone,
  onError,
}: {
  item: ContractItem;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.internal_number ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_contract_item_internal_number", {
      p_item_id: item.id,
      p_internal_number: value || null,
    });
    setSaving(false);
    if (error) { onError(error.message); return; }
    setEditing(false);
    onDone();
  }

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span>Número interno: {item.internal_number ?? "sin asignar"}</span>
        <button
          type="button"
          onClick={() => { setValue(item.internal_number ?? ""); setEditing(true); }}
          className="font-medium text-indigo-600 hover:underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ej: SIN-001"
        className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs font-medium text-slate-500 hover:underline"
      >
        Cancelar
      </button>
    </div>
  );
}

function RateForm({ itemId, onDone, onError }: { itemId: string; onDone: () => void; onError: (e: string | null) => void }) {
  const [validFrom, setValidFrom] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [includedHours, setIncludedHours] = useState("");
  const [overageRate, setOverageRate] = useState("");
  const [excessRule, setExcessRule] = useState<"franquicia_hora" | "manual">("franquicia_hora");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_contract_item_rate", {
      p_item_id: itemId,
      p_valid_from: validFrom,
      p_monthly_rate_usd: Number(monthlyRate),
      p_included_hours: includedHours ? Number(includedHours) : null,
      p_overage_rate_usd: overageRate ? Number(overageRate) : null,
      p_excess_rule: excessRule,
      p_note: note || null,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700">Nuevo ajuste de tarifa</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Vigente desde</label>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Regla</label>
          <select value={excessRule} onChange={(e) => setExcessRule(e.target.value as typeof excessRule)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="franquicia_hora">Franquicia + hora excedida</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Tarifa mensual (USD)</label>
          <input type="number" step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {excessRule === "franquicia_hora" && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700">Horas incluidas</label>
              <input type="number" step="0.01" value={includedHours} onChange={(e) => setIncludedHours(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Tarifa hora excedida (USD)</label>
              <input type="number" step="0.01" value={overageRate} onChange={(e) => setOverageRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700">Nota</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button onClick={submit} disabled={loading || !validFrom || !monthlyRate} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Guardar tarifa"}
      </button>
    </div>
  );
}

function UsageForm({
  itemId,
  installments,
  onDone,
  onError,
}: {
  itemId: string;
  installments: Installment[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [periodStart, setPeriodStart] = useState(installments[0]?.period_start ?? "");
  const [hours, setHours] = useState("");
  const [manualExpected, setManualExpected] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    const installment = installments.find((i) => i.period_start === periodStart);
    if (!installment) { onError("Elegí un período"); return; }
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let reportPath: string | null = null;
    let reportName: string | null = null;
    if (file) {
      const path = `${installment.contract_id}/informe_horas/${itemId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setLoading(false); onError(upErr.message); return; }
      reportPath = path;
      reportName = file.name;
    }

    const { error } = await supabase.rpc("record_contract_usage", {
      p_item_id: itemId,
      p_period_start: installment.period_start,
      p_period_end: installment.period_end,
      p_hours: Number(hours),
      p_report_storage_path: reportPath,
      p_report_file_name: reportName,
      p_manual_expected_usd: manualExpected ? Number(manualExpected) : null,
      p_manual_note: manualNote || null,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    if (fileInput.current) fileInput.current.value = "";
    onDone();
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700">Cargar horas del mes</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Período</label>
          <select value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {installments.map((i) => (
              <option key={i.id} value={i.period_start}>
                {formatDateOnly(i.period_start)} — {formatDateOnly(i.period_end)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Horas usadas</label>
          <input type="number" step="0.01" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-700">Informe del sector (opcional)</label>
          <input ref={fileInput} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Monto esperado manual (USD, si aplica)</label>
          <input type="number" step="0.01" value={manualExpected} onChange={(e) => setManualExpected(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Nota (obligatoria en modo manual)</label>
          <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button onClick={submit} disabled={loading || !periodStart || !hours} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading ? "Guardando…" : "Guardar horas"}
      </button>
    </div>
  );
}

// ---------- Documentos ----------

function DocumentosTab({
  contractId,
  documents,
  onDone,
  onError,
}: {
  contractId: string;
  documents: ContractDocument[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [docType, setDocType] = useState<ContractDocumentType>("contrato");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadableTypes: ContractDocumentType[] = ["contrato", "adenda", "condiciones", "seguro", "otro"];

  async function submit() {
    if (!file) { onError("Elegí un archivo"); return; }
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const path = `${contractId}/${docType}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) { setLoading(false); onError(upErr.message); return; }
    const { error } = await supabase.from("contract_documents").insert({
      contract_id: contractId,
      doc_type: docType,
      storage_path: path,
      file_name: file.name,
      expires_at: expiresAt || null,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    if (fileInput.current) fileInput.current.value = "";
    setFile(null);
    setExpiresAt("");
    onDone();
  }

  return (
    <div className="space-y-4">
      <Card title="Agregar documento">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Tipo</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as ContractDocumentType)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {uploadableTypes.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Vencimiento (opcional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Archivo</label>
            <input ref={fileInput} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
          </div>
        </div>
        <button onClick={submit} disabled={loading || !file} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {loading ? "Subiendo…" : "Agregar"}
        </button>
      </Card>

      <Card title={`Documentos (${documents.length})`}>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-400">Sin documentos todavía.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">
                  {CONTRACT_DOCUMENT_TYPE_LABELS[d.doc_type]}
                  {d.expires_at ? ` — vence ${formatDateOnly(d.expires_at)}` : ""}
                </span>
                <FilePreview url={d.url} fileName={d.file_name} label="Ver" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------- Cuotas ----------

function CuotasTab({
  contract,
  installments,
  expectedByPeriod,
  invoiceLines,
  providerInvoices,
  payments,
  invoiceFileUrls,
  items,
  onDone,
  onError,
}: {
  contract: Contract;
  installments: Installment[];
  expectedByPeriod: Record<string, number>;
  invoiceLines: InvoiceLine[];
  providerInvoices: ProviderInvoice[];
  payments: ProviderInvoice[];
  invoiceFileUrls: Record<string, string | null>;
  items: ContractItem[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [invoiceFormFor, setInvoiceFormFor] = useState<string | null>(null);
  const [paymentFormFor, setPaymentFormFor] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  function linesFor(periodStart: string) {
    return invoiceLines.filter(
      (l) => l.period_start === periodStart && l.invoice.status === "vigente" && l.invoice.kind !== "pago"
    );
  }

  function paymentLinesFor(periodStart: string) {
    return invoiceLines.filter(
      (l) => l.period_start === periodStart && l.invoice.status === "vigente" && l.invoice.kind === "pago"
    );
  }

  const paidFacturaIds = new Set(payments.filter((p) => p.status === "vigente").map((p) => p.paid_invoice_id));

  async function voidInvoice(invoiceId: string) {
    const reason = prompt("Motivo de la anulación:");
    if (!reason) return;
    onError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("void_provider_invoice", { p_invoice_id: invoiceId, p_reason: reason });
    if (error) { onError(error.message); return; }
    onDone();
  }

  async function acceptDifference(installmentId: string) {
    const note = prompt("Motivo para aceptar la diferencia:");
    if (!note) return;
    const amountStr = prompt("Monto de la diferencia (ARS):");
    onError(null);
    setAcceptingId(installmentId);
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_installment_difference", {
      p_installment_id: installmentId,
      p_amount: amountStr ? Number(amountStr) : null,
      p_note: note,
    });
    setAcceptingId(null);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <div className="space-y-4">
      <Card title="Cuotas">
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[1.3fr_110px_130px_130px_130px_150px_1fr_40px] items-center gap-x-3 text-sm">
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Período</div>
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Canon (USD)</div>
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Facturado (ARS)</div>
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Pagado (ARS)</div>
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Diferencia pago</div>
            <div className="pb-2 text-xs font-medium uppercase text-slate-400">Estado</div>
            <div className="pb-2"></div>
            <div className="pb-2"></div>

            {installments.map((inst) => {
              const lines = linesFor(inst.period_start);
              const invoicedArs = lines.reduce((sum, l) => sum + l.net_amount, 0);
              const payLines = paymentLinesFor(inst.period_start);
              const paidArs = payLines.reduce((sum, l) => sum + l.net_amount, 0);
              const paymentDiff = invoicedArs - paidArs;
              const isDetailOpen = detailFor === inst.id;
              const isInvoiceOpen = invoiceFormFor === inst.id;
              const isPaymentOpen = paymentFormFor === inst.id;
              return (
                <Fragment key={inst.id}>
                  <div className="border-b border-slate-100 py-2 pr-3 text-slate-700">
                    {formatDateOnly(inst.period_start)} — {formatDateOnly(inst.period_end)}
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3 text-slate-600">
                    {formatUsd(expectedByPeriod[inst.period_start] ?? 0)}
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3 text-slate-600">
                    {lines.length > 0 ? formatArs(invoicedArs) : "-"}
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3 text-slate-600">
                    {payLines.length > 0 ? formatArs(paidArs) : "-"}
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3">
                    {payLines.length > 0 && Math.abs(paymentDiff) > 1 ? (
                      <span className="font-medium text-amber-700">{formatArs(paymentDiff)}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${CONTRACT_INSTALLMENT_STATUS_COLORS[inst.status]}`}
                    >
                      {CONTRACT_INSTALLMENT_STATUS_LABELS[inst.status]}
                    </span>
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => { setPaymentFormFor(null); setDetailFor(null); setInvoiceFormFor((v) => (v === inst.id ? null : inst.id)); }}
                        title={isInvoiceOpen ? "Cancelar" : "Subir factura"}
                        aria-label={isInvoiceOpen ? "Cancelar" : "Subir factura"}
                        className={`rounded-md border p-1.5 ${isInvoiceOpen ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                      >
                        <IconFileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setInvoiceFormFor(null); setDetailFor(null); setPaymentFormFor((v) => (v === inst.id ? null : inst.id)); }}
                        title={isPaymentOpen ? "Cancelar" : "Subir recibo"}
                        aria-label={isPaymentOpen ? "Cancelar" : "Subir recibo"}
                        className={`rounded-md border p-1.5 ${isPaymentOpen ? "border-indigo-300 bg-indigo-50 text-indigo-600" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                      >
                        <IconReceipt className="h-4 w-4" />
                      </button>
                      {inst.status === "con_diferencia" && (
                        <button
                          onClick={() => acceptDifference(inst.id)}
                          disabled={acceptingId === inst.id}
                          className="text-xs font-medium text-amber-700 underline disabled:opacity-50"
                        >
                          Aceptar diferencia
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="border-b border-slate-100 py-2 pr-1 text-right">
                    <button
                      onClick={() => { setInvoiceFormFor(null); setPaymentFormFor(null); setDetailFor((v) => (v === inst.id ? null : inst.id)); }}
                      aria-label={isDetailOpen ? "Ocultar detalle de la cuota" : "Ver detalle de la cuota"}
                      aria-expanded={isDetailOpen}
                      className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <IconChevronDown
                        className={`h-4 w-4 transition-transform duration-300 ${isDetailOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  <CollapsiblePanel open={isDetailOpen}>
                    <InstallmentDetail
                      contractId={contract.id}
                      periodStart={inst.period_start}
                      invoices={lines.map((l) => l.invoice)}
                      payLines={payLines.map((l) => l.invoice)}
                      invoiceFileUrls={invoiceFileUrls}
                      paidFacturaIds={paidFacturaIds}
                      onVoid={voidInvoice}
                      onDone={onDone}
                      onError={onError}
                    />
                  </CollapsiblePanel>
                  <CollapsiblePanel open={isInvoiceOpen}>
                    <InvoiceForm
                      contract={contract}
                      items={items}
                      periodStart={inst.period_start}
                      onDone={() => { setInvoiceFormFor(null); onDone(); }}
                      onError={onError}
                    />
                  </CollapsiblePanel>
                  <CollapsiblePanel open={isPaymentOpen}>
                    <RegisterPaymentForm
                      contract={contract}
                      items={items}
                      periodStart={inst.period_start}
                      providerInvoices={providerInvoices}
                      defaultAmount={invoicedArs > 0 ? invoicedArs : undefined}
                      onDone={() => { setPaymentFormFor(null); onDone(); }}
                      onError={onError}
                    />
                  </CollapsiblePanel>
                </Fragment>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function InstallmentDetail({
  contractId,
  periodStart,
  invoices,
  payLines,
  invoiceFileUrls,
  paidFacturaIds,
  onVoid,
  onDone,
  onError,
}: {
  contractId: string;
  periodStart: string;
  invoices: ProviderInvoice[];
  payLines: ProviderInvoice[];
  invoiceFileUrls: Record<string, string | null>;
  paidFacturaIds: Set<string | null>;
  onVoid: (id: string) => void;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const uniqueInvoices = Array.from(new Map(invoices.map((i) => [i.id, i])).values());
  const uniquePayments = Array.from(new Map(payLines.map((i) => [i.id, i])).values());

  function Row({ inv }: { inv: ProviderInvoice }) {
    return (
      <li className="text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={inv.status === "anulado" ? "text-slate-400 line-through" : "text-slate-700"}>
              {PROVIDER_INVOICE_KIND_LABELS[inv.kind]} {inv.number ?? ""} — {formatDateOnly(inv.issue_date)} — {formatArs(inv.total_amount)}
            </span>
            {inv.kind === "factura" && inv.status === "vigente" && !paidFacturaIds.has(inv.id) && (
              <span className="inline-block whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Pendiente de pago
              </span>
            )}
            {inv.storage_path && (
              <FilePreview url={invoiceFileUrls[inv.storage_path] ?? null} fileName={inv.file_name ?? "archivo"} label="Ver archivo" />
            )}
          </div>
          {inv.status === "vigente" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditingId((v) => (v === inv.id ? null : inv.id))}
                className="text-xs font-medium text-indigo-600 underline"
              >
                {editingId === inv.id ? "Cancelar" : "Editar"}
              </button>
              <button onClick={() => onVoid(inv.id)} className="text-xs font-medium text-red-600 underline">
                Anular
              </button>
            </div>
          )}
        </div>
        {editingId === inv.id && (
          <EditComprobanteForm
            contractId={contractId}
            invoice={inv}
            onDone={() => { setEditingId(null); onDone(); }}
            onError={onError}
          />
        )}
      </li>
    );
  }

  return (
    <Card title={`Detalle de la cuota — período ${formatDateOnly(periodStart)}`}>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400">Facturas / notas de crédito</p>
        {uniqueInvoices.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">Sin facturas cargadas.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {uniqueInvoices.map((inv) => (
              <Row key={inv.id} inv={inv} />
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase text-slate-400">Pagos</p>
        {uniquePayments.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">Sin pagos cargados.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {uniquePayments.map((inv) => (
              <Row key={inv.id} inv={inv} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function EditComprobanteForm({
  contractId,
  invoice,
  onDone,
  onError,
}: {
  contractId: string;
  invoice: ProviderInvoice;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const isPago = invoice.kind === "pago";
  const [number, setNumber] = useState(invoice.number ?? "");
  const [issueDate, setIssueDate] = useState(invoice.issue_date);
  const [currency, setCurrency] = useState<"ars" | "usd">("ars");
  const [fxRate, setFxRate] = useState(invoice.fx_rate ? String(invoice.fx_rate) : "");
  const [netAmount, setNetAmount] = useState(invoice.net_amount ? String(invoice.net_amount) : "");
  const [grossUsd, setGrossUsd] = useState("");
  const [vatPct, setVatPct] = useState(
    invoice.net_amount && invoice.vat_amount ? String(Math.round((invoice.vat_amount / invoice.net_amount) * 10000) / 100) : "21"
  );
  const [totalAmount, setTotalAmount] = useState(String(invoice.total_amount));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const isUsd = currency === "usd";
  const computedTotal = isUsd ? Number(grossUsd || 0) * Number(fxRate || 0) : Number(netAmount || 0) * (1 + Number(vatPct || 0) / 100);
  const netArs = isUsd
    ? (Number(grossUsd || 0) / (1 + Number(vatPct || 0) / 100)) * Number(fxRate || 0)
    : Number(netAmount || 0);
  const vatArs = computedTotal - netArs;

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const path = `${contractId}/comprobantes/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setLoading(false); onError(upErr.message); return; }
      storagePath = path;
      fileName = file.name;
    }

    const { error } = await supabase.rpc("update_provider_invoice", {
      p_invoice_id: invoice.id,
      p_number: number || null,
      p_issue_date: issueDate,
      p_fx_rate: isPago ? null : (fxRate ? Number(fxRate) : null),
      p_net_amount: isPago ? null : netArs,
      p_vat_amount: isPago ? null : vatArs,
      p_total_amount: isPago ? Number(totalAmount) : computedTotal,
      p_storage_path: storagePath,
      p_file_name: fileName,
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700">Editar {isPago ? "pago" : "comprobante"}</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Número</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Fecha</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {isPago ? (
          <div>
            <label className="block text-xs font-medium text-slate-700">Monto pagado (ARS)</label>
            <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-700">Moneda de la factura</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "ars" | "usd")}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ars">ARS</option>
              <option value="usd">USD</option>
            </select>
          </div>
        )}
      </div>
      {!isPago && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Dólar venta BNA {!isUsd && "(opcional)"}
            </label>
            <input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {isUsd ? (
            <div>
              <label className="block text-xs font-medium text-slate-700">Bruto USD</label>
              <input type="number" step="0.01" value={grossUsd} onChange={(e) => setGrossUsd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700">Neto (ARS)</label>
              <input type="number" step="0.01" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700">% IVA</label>
            <input type="number" step="0.01" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Info label="Total (ARS)" value={formatArs(computedTotal)} />
        </div>
      )}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700">Reemplazar archivo (opcional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>
      <button
        onClick={submit}
        disabled={loading || !issueDate || (!isPago && isUsd && (!grossUsd || !fxRate))}
        className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}

function InvoiceForm({
  contract,
  items,
  periodStart,
  onDone,
  onError,
}: {
  contract: Contract;
  items: ContractItem[];
  periodStart: string;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [kind, setKind] = useState<Extract<ProviderInvoiceKind, "factura" | "nota_credito">>("factura");
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : "");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [currency, setCurrency] = useState<"ars" | "usd">("ars");
  const [fxRate, setFxRate] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [grossUsd, setGrossUsd] = useState("");
  const [vatPct, setVatPct] = useState("21");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const isUsd = currency === "usd";
  const totalArs = isUsd ? Number(grossUsd || 0) * Number(fxRate || 0) : Number(netAmount || 0) * (1 + Number(vatPct || 0) / 100);
  const netArs = isUsd
    ? (Number(grossUsd || 0) / (1 + Number(vatPct || 0) / 100)) * Number(fxRate || 0)
    : Number(netAmount || 0);
  const vatArs = totalArs - netArs;

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const path = `${contract.id}/comprobantes/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setLoading(false); onError(upErr.message); return; }
      storagePath = path;
      fileName = file.name;
    }

    const { error } = await supabase.rpc("record_provider_invoice", {
      p_provider_id: contract.provider!.id,
      p_kind: kind,
      p_number: number || null,
      p_issue_date: issueDate,
      p_fx_rate: fxRate ? Number(fxRate) : null,
      p_net_amount: netArs,
      p_vat_amount: vatArs,
      p_total_amount: totalArs,
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_paid_invoice_id: null,
      p_lines: [{ contract_id: contract.id, item_id: itemId || null, period_start: periodStart, net_amount: netArs }],
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <Card title={`Cargar factura / nota de crédito — período ${formatDateOnly(periodStart)}`}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "factura" | "nota_credito")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="factura">{PROVIDER_INVOICE_KIND_LABELS.factura}</option>
            <option value="nota_credito">{PROVIDER_INVOICE_KIND_LABELS.nota_credito}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Número</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Fecha</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700">Equipo</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Total del contrato</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Moneda de la factura</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "ars" | "usd")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ars">ARS</option>
            <option value="usd">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Dólar venta BNA {!isUsd && "(opcional)"}
          </label>
          <input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {isUsd ? (
          <div>
            <label className="block text-xs font-medium text-slate-700">Bruto USD</label>
            <input type="number" step="0.01" value={grossUsd} onChange={(e) => setGrossUsd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-700">Neto (ARS)</label>
            <input type="number" step="0.01" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700">% IVA</label>
          <input type="number" step="0.01" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <Info label="Neto (ARS)" value={formatArs(netArs)} />
        <Info label="IVA (ARS)" value={formatArs(vatArs)} />
        <Info label="Total (ARS)" value={formatArs(totalArs)} />
      </div>
      {!isUsd && !fxRate && (
        <p className="mt-2 text-xs text-slate-400">
          Sin el dólar de la factura, esta cuota queda marcada "Facturada" sin el chequeo automático de diferencia contra el canon.
        </p>
      )}

      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700">Archivo</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>

      <button
        onClick={submit}
        disabled={loading || !issueDate || (isUsd ? !grossUsd || !fxRate : !netAmount)}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar comprobante"}
      </button>
    </Card>
  );
}

function RegisterPaymentForm({
  contract,
  items,
  periodStart,
  providerInvoices,
  defaultAmount,
  onDone,
  onError,
}: {
  contract: Contract;
  items: ContractItem[];
  periodStart: string;
  providerInvoices: ProviderInvoice[];
  defaultAmount?: number;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [paidInvoiceId, setPaidInvoiceId] = useState(providerInvoices[0]?.id ?? "");
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : "");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const path = `${contract.id}/comprobantes/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contract-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setLoading(false); onError(upErr.message); return; }
      storagePath = path;
      fileName = file.name;
    }

    const { error } = await supabase.rpc("record_provider_invoice", {
      p_provider_id: contract.provider!.id,
      p_kind: "pago",
      p_number: number || null,
      p_issue_date: issueDate,
      p_fx_rate: null,
      p_net_amount: null,
      p_vat_amount: null,
      p_total_amount: Number(totalAmount),
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_paid_invoice_id: paidInvoiceId || null,
      p_lines: [{ contract_id: contract.id, item_id: itemId || null, period_start: periodStart, net_amount: Number(totalAmount) }],
    });
    setLoading(false);
    if (error) { onError(error.message); return; }
    onDone();
  }

  return (
    <Card title={`Registrar pago — período ${formatDateOnly(periodStart)}`}>
      <div>
        <label className="block text-xs font-medium text-slate-700">Factura que cancela</label>
        <select value={paidInvoiceId} onChange={(e) => setPaidInvoiceId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {providerInvoices.length === 0 && <option value="">Sin facturas vigentes de este proveedor</option>}
          {providerInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number ?? inv.id.slice(0, 8)} — {formatDateOnly(inv.issue_date)} — {formatArs(inv.total_amount)}
            </option>
          ))}
        </select>
      </div>

      {items.length > 1 && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-700">Equipo</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Total del contrato</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">Número de recibo (opcional)</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Fecha de pago</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Monto pagado (ARS)</label>
          <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-700">Comprobante de pago (opcional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>

      <button
        onClick={submit}
        disabled={loading || !issueDate || !totalAmount || !paidInvoiceId}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Registrar pago"}
      </button>
    </Card>
  );
}

// ---------- Historial ----------

function HistorialTab({ events }: { events: ContractEvent[] }) {
  const labels: Record<string, string> = {
    renovacion: "Renovación",
    cambio_tarifa: "Cambio de tarifa",
    aceptar_diferencia: "Diferencia aceptada",
    anulacion: "Comprobante anulado",
  };
  return (
    <Card>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">Sin eventos todavía.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="border-l-2 border-slate-200 pl-3 text-sm">
              <p className="text-slate-700">
                {ev.actor?.full_name ?? "Sistema"} — <span className="font-medium">{labels[ev.event_type] ?? ev.event_type}</span>
              </p>
              {ev.note && <p className="text-slate-500">{ev.note}</p>}
              <p className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString("es-AR")}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
