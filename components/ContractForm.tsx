"use client";

import { inputClass, labelClass, eyebrowClass } from "@/lib/ui";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { CONTRACT_ITEM_TYPE_LABELS, CONTRACT_RENEWAL_TYPE_LABELS, type ContractItemType, type ContractRenewalType } from "@/lib/contracts";

type Provider = { id: string; name: string };
type Plant = { id: string; name: string; prefix: string };
type Project = { id: string; name: string };

type ItemDraft = {
  type: ContractItemType;
  description: string;
  identifier: string;
  chassisNumber: string;
  domain: string;
  engineNumber: string;
  monthlyRateUsd: string;
  includedHours: string;
  overageRateUsd: string;
  excessRule: "franquicia_hora" | "manual";
};

const EMPTY_ITEM: ItemDraft = {
  type: "maquina",
  description: "",
  identifier: "",
  chassisNumber: "",
  domain: "",
  engineNumber: "",
  monthlyRateUsd: "",
  includedHours: "",
  overageRateUsd: "",
  excessRule: "franquicia_hora",
};

export default function ContractForm({
  providers,
  plants,
  projects,
}: {
  providers: Provider[];
  plants: Plant[];
  projects: Project[];
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [plantId, setPlantId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [renewalType, setRenewalType] = useState<ContractRenewalType>("expresa");
  const [renewalMonths, setRenewalMonths] = useState("");
  const [noticeDays, setNoticeDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const payloadItems = items.map((it) => ({
      type: it.type,
      description: it.description,
      identifier: it.identifier || null,
      chassis_number: it.chassisNumber || null,
      domain: it.domain || null,
      engine_number: it.engineNumber || null,
      monthly_rate_usd: Number(it.monthlyRateUsd),
      included_hours: it.includedHours || null,
      overage_rate_usd: it.overageRateUsd || null,
      excess_rule: it.excessRule,
    }));

    const { data: contract, error: createError } = await supabase.rpc("create_contract", {
      p_provider_id: providerId,
      p_plant_id: plantId || null,
      p_project_id: projectId || null,
      p_sic_id: null,
      p_start_date: startDate,
      p_end_date: endDate,
      p_renewal_type: renewalType,
      p_renewal_months: renewalMonths ? Number(renewalMonths) : null,
      p_notice_days: Number(noticeDays || 0),
      p_notes: notes || null,
      p_items: payloadItems,
    });

    if (createError || !contract) {
      setError(createError?.message ?? "No se pudo crear el contrato");
      setLoading(false);
      return;
    }

    notify.success("Contrato creado");
    router.push(`/contratos/${contract.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass({ padding: "lg", className: "space-y-4" })}>
      <div>
        <label className="block text-sm font-medium text-slate-700">Proveedor</label>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          required
          className={inputClass}
        >
          {providers.length === 0 && <option value="">No hay proveedores activos</option>}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Planta (opcional)</label>
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin planta</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.prefix})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Proyecto (opcional)</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Inicio</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Vencimiento</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Renovación</label>
          <select
            value={renewalType}
            onChange={(e) => setRenewalType(e.target.value as ContractRenewalType)}
            className={inputClass}
          >
            {(Object.keys(CONTRACT_RENEWAL_TYPE_LABELS) as ContractRenewalType[]).map((t) => (
              <option key={t} value={t}>
                {CONTRACT_RENEWAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Plazo renovación (meses)</label>
          <input
            type="number"
            min="0"
            value={renewalMonths}
            onChange={(e) => setRenewalMonths(e.target.value)}
            disabled={renewalType === "sin_renovacion"}
            className={`${inputClass} disabled:bg-slate-50`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Días de preaviso</label>
          <input
            type="number"
            min="0"
            value={noticeDays}
            onChange={(e) => setNoticeDays(e.target.value)}
            disabled={renewalType === "sin_renovacion"}
            className={`${inputClass} disabled:bg-slate-50`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Equipos</label>
        <div className="mt-2 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className={eyebrowClass}>Equipo {index + 1}</span>
                {items.length > 1 && (
                  <Button variant="link-danger" size="sm" onClick={() => removeItem(index)}>
                    Quitar
                  </Button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Tipo</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(index, { type: e.target.value as ContractItemType })}
                    className={inputClass}
                  >
                    {(Object.keys(CONTRACT_ITEM_TYPE_LABELS) as ContractItemType[]).map((t) => (
                      <option key={t} value={t}>
                        {CONTRACT_ITEM_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Descripción</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    required
                    placeholder="Ej: Retroexcavadora JCB 3CX"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Número de serie / identificador (opcional)</label>
                <input
                  value={item.identifier}
                  onChange={(e) => updateItem(index, { identifier: e.target.value })}
                  className={inputClass}
                />
              </div>
              {(item.type === "maquina" || item.type === "camioneta") && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>N° de chasis (opcional)</label>
                    <input
                      value={item.chassisNumber}
                      onChange={(e) => updateItem(index, { chassisNumber: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Dominio (opcional)</label>
                    <input
                      value={item.domain}
                      onChange={(e) => updateItem(index, { domain: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>N° de motor (opcional)</label>
                    <input
                      value={item.engineNumber}
                      onChange={(e) => updateItem(index, { engineNumber: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Regla de exceso</label>
                  <select
                    value={item.excessRule}
                    onChange={(e) => updateItem(index, { excessRule: e.target.value as ItemDraft["excessRule"] })}
                    className={inputClass}
                  >
                    <option value="franquicia_hora">Franquicia + hora excedida</option>
                    <option value="manual">Manual (monto cargado a mano)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tarifa fija mensual (USD, neta de IVA)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.monthlyRateUsd}
                    onChange={(e) => updateItem(index, { monthlyRateUsd: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              {item.excessRule === "franquicia_hora" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Horas incluidas por mes</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.includedHours}
                      onChange={(e) => updateItem(index, { includedHours: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tarifa por hora excedida (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.overageRateUsd}
                      onChange={(e) => updateItem(index, { overageRateUsd: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={addItem} className="mt-3">
          + Agregar equipo
        </Button>
      </div>

      {error && <p role="alert" className="animate-shake text-sm text-red-600">{error}</p>}

      <Button type="submit" loading={loading} disabled={providers.length === 0} className="w-full">
        {loading ? "Creando…" : "Crear contrato"}
      </Button>
    </form>
  );
}
