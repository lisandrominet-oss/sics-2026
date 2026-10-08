import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import ContractDetail from "@/components/ContractDetail";
import { IconArrowLeft } from "@/components/icons";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContratoDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select(
      "*, provider:providers(id, name, email, phone), plant:plants(name, prefix), project:projects(name), owner:profiles!contracts_owner_id_fkey(full_name)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (contractError) throw new Error(contractError.message);
  if (!contract) notFound();

  const { data: items } = await supabase
    .from("contract_items")
    .select("*")
    .eq("contract_id", params.id)
    .order("created_at");

  const itemIds = (items ?? []).map((i) => i.id);

  const [
    { data: rates },
    { data: usage },
    { data: installments },
    { data: documents },
    { data: events },
    { data: invoiceLines },
  ] = await Promise.all([
    itemIds.length > 0
      ? supabase.from("contract_item_rates").select("*").in("item_id", itemIds).order("valid_from")
      : Promise.resolve({ data: [] as never[] }),
    itemIds.length > 0
      ? supabase.from("contract_usage").select("*").in("item_id", itemIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("contract_installments").select("*").eq("contract_id", params.id).order("period_start"),
    supabase
      .from("contract_documents")
      .select("*")
      .eq("contract_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contract_events")
      .select("*, actor:profiles(full_name)")
      .eq("contract_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("provider_invoice_lines")
      .select("*, invoice:provider_invoices(*)")
      .eq("contract_id", params.id),
  ]);

  const expectedByPeriod = Object.fromEntries(
    await Promise.all(
      (installments ?? []).map(async (inst) => {
        const { data } = await supabase.rpc("get_contract_installment_expected_usd", {
          p_contract_id: params.id,
          p_period_start: inst.period_start,
        });
        return [inst.period_start, data ?? 0] as const;
      })
    )
  );

  const filesWithUrls = await Promise.all(
    (documents ?? []).map(async (d) => {
      const { data } = await supabase.storage.from("contract-files").createSignedUrl(d.storage_path, 300);
      return { ...d, url: data?.signedUrl ?? null };
    })
  );

  const provider = contract.provider as { id: string; name: string; email: string | null; phone: string | null } | null;

  const { data: providerInvoices } = provider
    ? await supabase
        .from("provider_invoices")
        .select("*")
        .eq("provider_id", provider.id)
        .eq("kind", "factura")
        .eq("status", "vigente")
        .order("issue_date", { ascending: false })
    : { data: [] as never[] };

  const facturaIds = Array.from(new Set((invoiceLines ?? []).map((l) => l.invoice.id)));
  const { data: payments } =
    facturaIds.length > 0
      ? await supabase.from("provider_invoices").select("*").eq("kind", "pago").in("paid_invoice_id", facturaIds)
      : { data: [] as never[] };

  const invoiceStoragePaths = new Set<string>();
  (invoiceLines ?? []).forEach((l) => {
    if (l.invoice.storage_path) invoiceStoragePaths.add(l.invoice.storage_path);
  });
  (payments ?? []).forEach((p) => {
    if (p.storage_path) invoiceStoragePaths.add(p.storage_path);
  });
  const invoiceFileUrls = Object.fromEntries(
    await Promise.all(
      Array.from(invoiceStoragePaths).map(async (path) => {
        const { data } = await supabase.storage.from("contract-files").createSignedUrl(path, 300);
        return [path, data?.signedUrl ?? null] as const;
      })
    )
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/contratos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <IconArrowLeft />
        Volver a Contratos
      </Link>

      <div className="mt-4">
        <ContractDetail
          contract={contract}
          items={items ?? []}
          rates={rates ?? []}
          usage={usage ?? []}
          installments={installments ?? []}
          expectedByPeriod={expectedByPeriod}
          documents={filesWithUrls}
          events={events ?? []}
          invoiceLines={invoiceLines ?? []}
          providerInvoices={providerInvoices ?? []}
          payments={payments ?? []}
          invoiceFileUrls={invoiceFileUrls}
        />
      </div>
    </div>
  );
}
