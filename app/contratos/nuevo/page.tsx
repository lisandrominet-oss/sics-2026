import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import ContractForm from "@/components/ContractForm";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoContratoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();

  const [{ data: providers }, { data: plants }, { data: projects }] = await Promise.all([
    supabase.from("providers").select("id, name").eq("active", true).order("name"),
    supabase.from("plants").select("id, name, prefix").eq("active", true).order("name"),
    supabase.from("projects").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Compras"
          title="Nuevo contrato"
          description="Cargá el proveedor, las fechas y los equipos alquilados con su tarifa."
        />
        <div className="mt-6">
          <ContractForm providers={providers ?? []} plants={plants ?? []} projects={projects ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
