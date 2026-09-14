"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfigForm({
  threshold,
  domains,
}: {
  threshold: number;
  domains: string[];
}) {
  const router = useRouter();
  const [thresholdValue, setThresholdValue] = useState(String(threshold));
  const [domainsValue, setDomainsValue] = useState(domains.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const domainList = domainsValue
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const { error: err1 } = await supabase
      .from("app_settings")
      .update({ value: Number(thresholdValue) })
      .eq("key", "gerencia_approval_threshold_ars");

    const { error: err2 } = await supabase
      .from("app_settings")
      .update({ value: domainList })
      .eq("key", "allowed_email_domains");

    setSaving(false);
    if (err1 || err2) {
      setError(err1?.message ?? err2?.message ?? "Error al guardar");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Monto tope para aprobación de Gerencia (ARS)
        </label>
        <input
          type="number"
          value={thresholdValue}
          onChange={(e) => setThresholdValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Dominios de email habilitados (separados por coma)
        </label>
        <input
          value={domainsValue}
          onChange={(e) => setDomainsValue(e.target.value)}
          placeholder="miconect.com, ser-ind.com.ar"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Guardado.</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}
