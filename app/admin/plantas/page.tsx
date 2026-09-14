import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PlantsManager from "@/components/PlantsManager";

export default async function PlantasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: plants } = await supabase.from("plants").select("*").order("name");

  return (
    <AppShell
      role={profile.role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Administración</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Plantas / Empresas</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cada planta tiene un prefijo único que se usa para numerar las SICs (ej. SIC-TAMET-2026-0001).
        </p>
        <div className="mt-6">
          <PlantsManager plants={plants ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
