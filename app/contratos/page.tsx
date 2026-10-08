import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import ContractsList, { type InvoiceLine } from "@/components/ContractsList";
import { buttonClass } from "@/components/ui/Button";
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
    { data: invoiceLines },
    { data: contractDebts },
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
    // Para los totales facturado y pagado por proveedor (sin IVA).
    supabase.from("provider_invoice_lines").select("contract_id, net_amount, invoice:provider_invoices(kind, status)"),
    // Deuda en USD por contrato (canon exacto de las cuotas menos lo pagado).
    supabase.rpc("get_contract_debt_usd"),
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
        <PageHeader
          eyebrow="Compras"
          title="Contratos"
          description="Alquileres de máquinas, camionetas y herramientas: cuotas, vencimientos y control contra factura."
          actions={
            <Link href="/contratos/nuevo" className={buttonClass()}>
              <IconPlusCircle className="h-4 w-4" />
              Nuevo contrato
            </Link>
          }
        />

        <div className="mt-6">
          <ContractsList
            contracts={contracts ?? []}
            items={items ?? []}
            rates={rates ?? []}
            installments={installments ?? []}
            documents={documents ?? []}
            attendedAlerts={alerts ?? []}
            providers={providers ?? []}
            invoiceLines={(invoiceLines ?? []) as unknown as InvoiceLine[]}
            contractDebts={(contractDebts ?? []) as { contract_id: string; remaining_usd: number }[]}
          />
        </div>
      </div>
    </AppShell>
  );
}
