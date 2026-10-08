"use client";

import { inputClass, labelClass, eyebrowClass } from "@/lib/ui";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import FilePreview from "@/components/FilePreview";
import { IconChevronDown, IconFileText, IconReceipt } from "@/components/icons";
import { formatDate, sanitizeFileName } from "@/lib/constants";
import {
  CONTRACT_DISPLAY_STATUS_TONES,
  CONTRACT_DISPLAY_STATUS_LABELS,
  CONTRACT_DOCUMENT_TYPE_LABELS,
  CONTRACT_INSTALLMENT_STATUS_TONES,
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
import InfoItem from "@/components/ui/InfoItem";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import PromptDialog from "@/components/ui/PromptDialog";

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

// Importe en formato argentino: "1.234,50" (punto de miles, coma decimal), "1234,5" o "1234.5". Devuelve null si no es válido.
function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!/^-?(\d{1,3}(\.\d{3})+(,\d+)?|\d+([.,]\d+)?)$/.test(t)) return null;
  const n = Number(t.includes(",") || /\.\d{3}\./.test(t) || /^-?\d{1,3}\.\d{3}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

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
  const status = contractDisplayStatus(contract);

  // Los errores de las acciones se muestran como aviso (toast); `null` es "limpiar" y ya no hace falta.
  function setError(message: string | null) {
    if (message) notify.error("No se pudo completar la acción", message);
  }

  function refresh() {
    notify.success("Cambios guardados");
    router.refresh();
  }

  const paid = installments.filter((i) => i.status === "pagada").length;

  return (
    <div>
      <PageHeader
        className="!items-start"
        eyebrow={contract.provider?.name ?? "Proveedor"}
        title={items.map((i) => i.description).join(", ") || "Contrato"}
        actions={<Badge tone={CONTRACT_DISPLAY_STATUS_TONES[status]}>{CONTRACT_DISPLAY_STATUS_LABELS[status]}</Badge>}
      />

      <Card className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <InfoItem label="Inicio" value={formatDateOnly(contract.start_date)} />
        <InfoItem label="Vencimiento" value={formatDateOnly(contract.end_date)} />
        <InfoItem label="Cuotas" value={`${paid}/${installments.length} pagadas`} />
        <InfoItem label="Responsable" value={contract.owner?.full_name ?? "-"} />
      </Card>

      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200 text-sm">
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
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 font-medium ${
              tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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

// El contenido se desmonta recién cuando termina de cerrarse (así se ve plegarse) y no antes:
// al desmontarlo se reinician los formularios que contiene.
function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  // Si se reabre antes de que termine de desmontarse, el contenido se vuelve a montar: los formularios arrancan vacíos.
  const wasOpen = useRef(open);
  const generation = useRef(0);
  if (open && !wasOpen.current && mounted) generation.current += 1;
  wasOpen.current = open;
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 200); // un poco más que `duration-close` (160 ms)
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div
      className={`col-span-full grid transition-[grid-template-rows] ease-drawer ${open ? "duration-open" : "duration-close"}`}
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      {/* `inert` mientras está cerrado: durante la salida el contenido no recibe foco ni toques (evita un segundo envío). */}
      <div className="overflow-hidden" {...(open ? {} : ({ inert: "" } as Record<string, string>))}>
        <div key={generation.current} className="py-3">{open || mounted ? children : null}</div>
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
          <InfoItem label="Planta" value={contract.plant ? `${contract.plant.name} (${contract.plant.prefix})` : "-"} />
          <InfoItem label="Proyecto" value={contract.project?.name ?? "-"} />
          <InfoItem label="Contacto proveedor" value={contract.provider?.email ?? contract.provider?.phone ?? "-"} />
          <InfoItem label="Renovación" value={CONTRACT_RENEWAL_TYPE_LABELS[contract.renewal_type]} />
          <InfoItem label="Días de preaviso" value={String(contract.notice_days)} />
          <InfoItem label="Plazo de renovación" value={contract.renewal_months ? `${contract.renewal_months} meses` : "-"} />
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
          <Button variant="secondary" onClick={() => setEditOpen((v) => !v)}>
            {editOpen ? "Cancelar" : "Editar contrato"}
          </Button>
          <Button variant="secondary" onClick={() => setRenewOpen((v) => !v)}>
            {renewOpen ? "Cancelar" : "Renovar"}
          </Button>
          <Button variant="danger-outline" onClick={() => setReturnOpen((v) => !v)}>
            {returnOpen ? "Cancelar" : "Devolver equipo y finalizar contrato"}
          </Button>
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
          <label className={labelClass}>Inicio</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Vencimiento</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Renovación</label>
          <select
            value={renewalType}
            onChange={(e) => setRenewalType(e.target.value as ContractRenewalType)}
            className={inputClass}
          >
            {(Object.keys(CONTRACT_RENEWAL_TYPE_LABELS) as ContractRenewalType[]).map((t) => (
              <option key={t} value={t}>{CONTRACT_RENEWAL_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Plazo renovación (meses)</label>
          <input type="number" min="0" value={renewalMonths} onChange={(e) => setRenewalMonths(e.target.value)} disabled={renewalType === "sin_renovacion"} className={`${inputClass} disabled:bg-slate-50`} />
        </div>
        <div>
          <label className={labelClass}>Días de preaviso</label>
          <input type="number" min="0" value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} disabled={renewalType === "sin_renovacion"} className={`${inputClass} disabled:bg-slate-50`} />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>Notas (opcional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>
      <Button onClick={submit} loading={loading} className="mt-3">
        {loading ? "Guardando…" : "Guardar cambios"}
      </Button>
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
          <label className={labelClass}>Nuevo vencimiento</label>
          <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Nota (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
      </div>
      <Button onClick={submit} loading={loading} disabled={!newEndDate} className="mt-3">
        {loading ? "Guardando…" : "Confirmar renovación"}
      </Button>
    </Card>
  );
}

function ReturnForm({ contractId, onDone, onError }: { contractId: string; onDone: () => void; onError: (e: string | null) => void }) {
  const [returnDate, setReturnDate] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!file) { setFormError("Hace falta adjuntar el acta de devolución"); return; }
    setFormError(null);
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const path = `${contractId}/acta_devolucion/${Date.now()}-${sanitizeFileName(file.name)}`;
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
          <label className={labelClass}>Fecha de devolución</label>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Acta de devolución (obligatoria)</label>
          <input type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFormError(null); }} className="mt-1 w-full text-xs" />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>Nota (opcional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Esto cancela las cuotas futuras que todavía no fueron facturadas.</p>
      <Button variant="danger" onClick={submit} loading={loading} disabled={!returnDate || !file} className="mt-3">
        {loading ? "Guardando…" : "Confirmar devolución"}
      </Button>
      {formError && <p role="alert" className="mt-2 text-xs text-red-600">{formError}</p>}
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
          <Button variant="secondary" size="sm" onClick={() => setEditItemOpen((v) => !v)}>
            {editItemOpen ? "Cancelar" : "Editar equipo"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setUsageFormOpen((v) => !v)}>
            Cargar horas del mes
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setRateFormOpen((v) => !v)}>
            Ajustar tarifa
          </Button>
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
          <InfoItem label="Tarifa mensual" value={formatUsd(current.monthly_rate_usd)} />
          <InfoItem label="Horas incluidas" value={current.included_hours ? String(current.included_hours) : "-"} />
          <InfoItem label="Hora excedida" value={current.overage_rate_usd ? formatUsd(current.overage_rate_usd) : "-"} />
          <InfoItem label="Regla" value={current.excess_rule === "manual" ? "Manual" : "Franquicia + hora excedida"} />
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
              <li key={u.id} className="[overflow-wrap:anywhere]">
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
        <label className={labelClass}>Descripción</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>
      <div className="mt-2">
        <label className={labelClass}>Número de serie / identificador</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputClass} />
      </div>
      {showVehicleFields && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>N° de chasis</label>
            <input value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Dominio</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>N° de motor</label>
            <input value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}
      <Button size="sm" onClick={submit} loading={loading} disabled={!description} className="mt-3">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
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
        <Button variant="link" onClick={() => { setValue(item.internal_number ?? ""); setEditing(true); }}>
          Editar
        </Button>
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
      <Button size="sm" onClick={save} loading={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
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
          <label className={labelClass}>Vigente desde</label>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Regla</label>
          <select value={excessRule} onChange={(e) => setExcessRule(e.target.value as typeof excessRule)} className={inputClass}>
            <option value="franquicia_hora">Franquicia + hora excedida</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Tarifa mensual (USD)</label>
          <input type="number" step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} className={inputClass} />
        </div>
        {excessRule === "franquicia_hora" && (
          <>
            <div>
              <label className={labelClass}>Horas incluidas</label>
              <input type="number" step="0.01" value={includedHours} onChange={(e) => setIncludedHours(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tarifa hora excedida (USD)</label>
              <input type="number" step="0.01" value={overageRate} onChange={(e) => setOverageRate(e.target.value)} className={inputClass} />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className={labelClass}>Nota</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
      </div>
      <Button onClick={submit} loading={loading} disabled={!validFrom || !monthlyRate} className="mt-3">
        {loading ? "Guardando…" : "Guardar tarifa"}
      </Button>
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
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    const installment = installments.find((i) => i.period_start === periodStart);
    if (!installment) { setFormError("Elegí un período"); return; }
    setFormError(null);
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let reportPath: string | null = null;
    let reportName: string | null = null;
    if (file) {
      const path = `${installment.contract_id}/informe_horas/${itemId}/${Date.now()}-${sanitizeFileName(file.name)}`;
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
          <label className={labelClass}>Período</label>
          <select value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setFormError(null); }} className={inputClass}>
            {installments.map((i) => (
              <option key={i.id} value={i.period_start}>
                {formatDateOnly(i.period_start)} — {formatDateOnly(i.period_end)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Horas usadas</label>
          <input type="number" step="0.01" value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Informe del sector (opcional)</label>
          <input ref={fileInput} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
        </div>
        <div>
          <label className={labelClass}>Monto esperado manual (USD, si aplica)</label>
          <input type="number" step="0.01" value={manualExpected} onChange={(e) => setManualExpected(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Nota (obligatoria en modo manual)</label>
          <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} className={inputClass} />
        </div>
      </div>
      <Button onClick={submit} loading={loading} disabled={!periodStart || !hours} className="mt-3">
        {loading ? "Guardando…" : "Guardar horas"}
      </Button>
      {formError && <p role="alert" className="mt-2 text-xs text-red-600">{formError}</p>}
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
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadableTypes: ContractDocumentType[] = ["contrato", "adenda", "condiciones", "seguro", "otro"];

  async function submit() {
    if (!file) { setFormError("Elegí un archivo"); return; }
    setFormError(null);
    setLoading(true);
    onError(null);
    const supabase = createClient();
    const path = `${contractId}/${docType}/${Date.now()}-${sanitizeFileName(file.name)}`;
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as ContractDocumentType)} className={inputClass}>
              {uploadableTypes.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Vencimiento (opcional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Archivo</label>
            <input ref={fileInput} type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFormError(null); }} className="mt-1 w-full text-xs" />
          </div>
        </div>
        <Button onClick={submit} loading={loading} disabled={!file} className="mt-3">
          {loading ? "Subiendo…" : "Agregar"}
        </Button>
        {formError && <p role="alert" className="mt-2 text-xs text-red-600">{formError}</p>}
      </Card>

      <Card title={`Documentos (${documents.length})`}>
        {documents.length === 0 ? (
          <EmptyState size="sm" title="Sin documentos todavía." />
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-slate-600 [overflow-wrap:anywhere]">
                  {CONTRACT_DOCUMENT_TYPE_LABELS[d.doc_type]}
                  {d.expires_at ? ` — vence ${formatDateOnly(d.expires_at)}` : ""}
                  <span className="block text-xs text-slate-400">{d.file_name}</span>
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
  const [voidFor, setVoidFor] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<string | null>(null);

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

  async function voidInvoice(invoiceId: string, reason: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("void_provider_invoice", { p_invoice_id: invoiceId, p_reason: reason });
    if (error) { onError(error.message); return false; }
    onDone();
  }

  async function acceptDifference(installmentId: string, note: string, amount: number | null) {
    setAcceptingId(installmentId);
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_installment_difference", {
      p_installment_id: installmentId,
      p_amount: amount,
      p_note: note,
    });
    setAcceptingId(null);
    if (error) { onError(error.message); return false; }
    onDone();
  }

  return (
    <div className="space-y-4">
      <Card title="Cuotas">
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[1.2fr_110px_130px_130px_130px_175px_minmax(76px,1fr)_40px] items-center gap-x-3 text-sm tabular-nums">
            <div className={`${eyebrowClass} pb-2`}>Período</div>
            <div className={`${eyebrowClass} pb-2`}>Canon (USD)</div>
            <div className={`${eyebrowClass} pb-2`}>Facturado (ARS)</div>
            <div className={`${eyebrowClass} pb-2`}>Pagado (ARS)</div>
            <div className={`${eyebrowClass} pb-2`}>Diferencia pago</div>
            <div className={`${eyebrowClass} pb-2`}>Estado</div>
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
                    <span className="block whitespace-nowrap">{formatDateOnly(inst.period_start)}</span>
                    <span className="block whitespace-nowrap text-xs text-slate-400">→ {formatDateOnly(inst.period_end)}</span>
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
                    <Badge tone={CONTRACT_INSTALLMENT_STATUS_TONES[inst.status]}>
                      {CONTRACT_INSTALLMENT_STATUS_LABELS[inst.status]}
                    </Badge>
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
                        <Button variant="link" size="sm" onClick={() => setAcceptFor(inst.id)} disabled={acceptingId === inst.id}>
                          Aceptar diferencia
                        </Button>
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
                        className={`h-4 w-4 transition-transform ease-drawer ${isDetailOpen ? "rotate-180 duration-open" : "duration-close"}`}
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
                      onVoid={setVoidFor}
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

      <PromptDialog
        open={voidFor !== null}
        onClose={() => setVoidFor(null)}
        title="Anular comprobante"
        description="Queda registrado en el historial del contrato."
        fields={[{ name: "reason", label: "Motivo de la anulación", required: true }]}
        confirmLabel="Anular"
        destructive
        onSubmit={({ reason }) => voidInvoice(voidFor as string, reason)}
      />
      <PromptDialog
        open={acceptFor !== null}
        onClose={() => setAcceptFor(null)}
        title="Aceptar diferencia"
        fields={[
          { name: "note", label: "Motivo para aceptar la diferencia", required: true },
          {
            name: "amount",
            label: "Monto de la diferencia (ARS)",
            hint: "Opcional. Ej.: 1.234,50 o 1234,5.",
            inputMode: "decimal",
            validate: (v) => (parseAmount(v) === null ? "Ingresá un número válido." : null),
          },
        ]}
        confirmLabel="Aceptar diferencia"
        onSubmit={({ note, amount }) => acceptDifference(acceptFor as string, note, amount ? parseAmount(amount) : null)}
      />
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
              <Badge tone="warning" size="sm">
                Pendiente de pago
              </Badge>
            )}
            {inv.storage_path && (
              <FilePreview url={invoiceFileUrls[inv.storage_path] ?? null} fileName={inv.file_name ?? "archivo"} label="Ver archivo" />
            )}
          </div>
          {inv.status === "vigente" && (
            <div className="flex items-center gap-3">
              <Button variant="link" size="sm" onClick={() => setEditingId((v) => (v === inv.id ? null : inv.id))}>
                {editingId === inv.id ? "Cancelar" : "Editar"}
              </Button>
              <Button variant="link-danger" size="sm" onClick={() => onVoid(inv.id)}>
                Anular
              </Button>
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
        <p className={eyebrowClass}>Facturas / notas de crédito</p>
        {uniqueInvoices.length === 0 ? (
          <EmptyState size="sm" className="mt-1" title="Sin facturas cargadas." />
        ) : (
          <ul className="mt-2 space-y-3">
            {uniqueInvoices.map((inv) => (
              <Row key={inv.id} inv={inv} />
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className={eyebrowClass}>Pagos</p>
        {uniquePayments.length === 0 ? (
          <EmptyState size="sm" className="mt-1" title="Sin pagos cargados." />
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
  const [subtotalUsd, setSubtotalUsd] = useState("");
  const [vatPct, setVatPct] = useState(
    invoice.net_amount && invoice.vat_amount ? String(Math.round((invoice.vat_amount / invoice.net_amount) * 10000) / 100) : "21"
  );
  const [totalAmount, setTotalAmount] = useState(String(invoice.total_amount));
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const isUsd = currency === "usd";
  const netArs = isUsd ? Number(subtotalUsd || 0) * Number(fxRate || 0) : Number(netAmount || 0);
  const vatArs = netArs * (Number(vatPct || 0) / 100);
  const computedTotal = netArs + vatArs;

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const path = `${contractId}/comprobantes/${Date.now()}-${sanitizeFileName(file.name)}`;
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
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Número</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
        </div>
        {isPago ? (
          <div>
            <label className={labelClass}>Monto pagado sin IVA (ARS)</label>
            <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputClass} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Moneda de la factura</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "ars" | "usd")}
              className={inputClass}
            >
              <option value="ars">ARS</option>
              <option value="usd">USD</option>
            </select>
          </div>
        )}
      </div>
      {!isPago && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>
              Dólar venta BNA {!isUsd && "(opcional)"}
            </label>
            <input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className={inputClass} />
          </div>
          {isUsd ? (
            <div>
              <label className={labelClass}>Subtotal USD</label>
              <input type="number" step="0.01" value={subtotalUsd} onChange={(e) => setSubtotalUsd(e.target.value)} className={inputClass} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Neto (ARS)</label>
              <input type="number" step="0.01" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass}>% IVA</label>
            <input type="number" step="0.01" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className={inputClass} />
          </div>
          <InfoItem label="Total (ARS)" value={formatArs(computedTotal)} />
        </div>
      )}
      <div className="mt-3">
        <label className={labelClass}>Reemplazar archivo (opcional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>
      <Button size="sm" onClick={submit} loading={loading} disabled={!issueDate || (!isPago && isUsd && (!subtotalUsd || !fxRate))} className="mt-3">
        {loading ? "Guardando…" : "Guardar cambios"}
      </Button>
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
  const [subtotalUsd, setSubtotalUsd] = useState("");
  const [vatPct, setVatPct] = useState("21");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const isUsd = currency === "usd";
  const netArs = isUsd ? Number(subtotalUsd || 0) * Number(fxRate || 0) : Number(netAmount || 0);
  const vatArs = netArs * (Number(vatPct || 0) / 100);
  const totalArs = netArs + vatArs;

  async function submit() {
    setLoading(true);
    onError(null);
    const supabase = createClient();

    let storagePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const path = `${contract.id}/comprobantes/${Date.now()}-${sanitizeFileName(file.name)}`;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Tipo</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "factura" | "nota_credito")}
            className={inputClass}
          >
            <option value="factura">{PROVIDER_INVOICE_KIND_LABELS.factura}</option>
            <option value="nota_credito">{PROVIDER_INVOICE_KIND_LABELS.nota_credito}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Número</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-3">
          <label className={labelClass}>Equipo</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>
            <option value="">Total del contrato</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Moneda de la factura</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "ars" | "usd")}
            className={inputClass}
          >
            <option value="ars">ARS</option>
            <option value="usd">USD</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Dólar venta BNA {!isUsd && "(opcional)"}
          </label>
          <input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(e.target.value)} className={inputClass} />
        </div>
        {isUsd ? (
          <div>
            <label className={labelClass}>Subtotal USD</label>
            <input type="number" step="0.01" value={subtotalUsd} onChange={(e) => setSubtotalUsd(e.target.value)} className={inputClass} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Neto (ARS)</label>
            <input type="number" step="0.01" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <label className={labelClass}>% IVA</label>
          <input type="number" step="0.01" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <InfoItem label="Neto (ARS)" value={formatArs(netArs)} />
        <InfoItem label="IVA (ARS)" value={formatArs(vatArs)} />
        <InfoItem label="Total (ARS)" value={formatArs(totalArs)} />
      </div>
      {!isUsd && !fxRate && (
        <p className="mt-2 text-xs text-slate-400">
          Sin el dólar de la factura, esta cuota queda marcada "Facturada" sin el chequeo automático de diferencia contra el canon.
        </p>
      )}

      <div className="mt-3">
        <label className={labelClass}>Archivo</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>

      <Button onClick={submit} loading={loading} disabled={!issueDate || (isUsd ? !subtotalUsd || !fxRate : !netAmount)} className="mt-4">
        {loading ? "Guardando…" : "Guardar comprobante"}
      </Button>
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
      const path = `${contract.id}/comprobantes/${Date.now()}-${sanitizeFileName(file.name)}`;
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
        <label className={labelClass}>Factura que cancela</label>
        <select value={paidInvoiceId} onChange={(e) => setPaidInvoiceId(e.target.value)} className={inputClass}>
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
          <label className={labelClass}>Equipo</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>
            <option value="">Total del contrato</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Número de recibo (opcional)</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha de pago</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Monto pagado sin IVA (ARS)</label>
          <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>Comprobante de pago (opcional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
      </div>

      <Button onClick={submit} loading={loading} disabled={!issueDate || !totalAmount || !paidInvoiceId} className="mt-4">
        {loading ? "Guardando…" : "Registrar pago"}
      </Button>
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
    edicion_fechas: "Fechas editadas",
    edicion_equipo: "Equipo editado",
    numero_interno: "N° interno modificado",
    edicion_comprobante: "Comprobante editado",
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
              {ev.note && <p className="text-slate-500 [overflow-wrap:anywhere]">{ev.note}</p>}
              <p className="text-xs text-slate-400">{formatDate(ev.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
