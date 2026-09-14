import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import NuevaSicForm from "@/components/NuevaSicForm";
import { CAN_CREATE_SIC, effectiveRole } from "@/lib/constants";

export default async function NuevaSicPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (!CAN_CREATE_SIC.includes(role)) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: plants }, { data: projects }] = await Promise.all([
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
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistema de Compras</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nueva solicitud interna de compra</h1>
        <p className="mt-2 text-sm text-slate-500">
          Completá los datos de tu solicitud. Compras la va a revisar y buscar cotizaciones.
        </p>
        <div className="mt-6">
          <NuevaSicForm
            plants={plants ?? []}
            projects={projects ?? []}
            defaultPlantId={profile.plant_id}
            lockPlant={false}
          />
        </div>
      </div>
    </AppShell>
  );
}
