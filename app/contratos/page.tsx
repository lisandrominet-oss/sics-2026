import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ContractsList from "@/components/ContractsList";
import { IconPlusCircle } from "@/components/icons";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContratosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();

  const [
    { data: contracts },
    { data: items },
    { data: rates },
    { data: installments },
    { data: documents },
    { data: alerts },
    { data: providers },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("*, provider:providers(name), plant:plants(name, prefix), project:projects(name)")
      .order("end_date"),
    supabase.from("contract_items").select("*"),
    supabase.from("contract_item_rates").select("*").order("valid_from"),
    supabase.from("contract_installments").select("id, contract_id, period_start, period_end, status"),
    supabase.from("contract_documents").select("id, contract_id, provider_id, doc_type, expires_at, file_name"),
    supabase.from("contract_alerts").select("kind, target_id"),
    supabase.from("providers").select("id, name").order("name"),
  ]);

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compras</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Contratos</h1>
            <p className="mt-2 text-sm text-slate-500">
              Alquileres de máquinas, camionetas y herramientas: cuotas, vencimientos y control contra
              factura.
            </p>
          </div>
          <Link
            href="/contratos/nuevo"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <IconPlusCircle className="h-4 w-4" />
            Nuevo contrato
          </Link>
        </div>

        <div className="mt-6">
          <ContractsList
            contracts={contracts ?? []}
            items={items ?? []}
            rates={rates ?? []}
            installments={installments ?? []}
            documents={documents ?? []}
            attendedAlerts={alerts ?? []}
            providers={providers ?? []}
          />
        </div>
      </div>
    </AppShell>
  );
}
