import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { effectiveRole } from "@/lib/constants";
import PlantsManager from "@/components/PlantsManager";

export default async function PlantasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: plants } = await supabase.from("plants").select("*").order("name");

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Sistema"
          title="Plantas / Empresas"
          description="Cada planta tiene un prefijo único que se usa para numerar las SICs (ej. SIC-TAMET-2026-0001)."
        />
        <div className="mt-6">
          <PlantsManager plants={plants ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
