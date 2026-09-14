import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import PlantsManager from "@/components/PlantsManager";

export default async function PlantasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: plants } = await supabase.from("plants").select("*").order("name");

  return (
    <div>
      <Nav
        role={profile.role}
        realRole={profile.role}
        userId={profile.id}
        actingAsRole={profile.acting_as_role}
        fullName={profile.full_name}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">Plantas / Empresas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada planta tiene un prefijo único que se usa para numerar las SICs (ej. SIC-TAMET-2026-0001).
        </p>
        <div className="mt-6">
          <PlantsManager plants={plants ?? []} />
        </div>
      </main>
    </div>
  );
}
