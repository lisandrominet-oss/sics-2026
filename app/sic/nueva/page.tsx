import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
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

  const canPickPlant = role === "compras" || role === "admin";

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
          title="Nueva solicitud interna de compra"
          description={
            role === "operativo" || role === "panol"
              ? "Completá los datos de tu solicitud. Primero la revisa el jefe de tu área y después pasa a Compras."
              : "Completá los datos de tu solicitud. Compras la va a revisar y buscar cotizaciones."
          }
        />
        <div className="mt-6">
          <NuevaSicForm
            plants={plants ?? []}
            projects={projects ?? []}
            defaultPlantId={profile.plant_id}
            canPickPlant={canPickPlant}
          />
        </div>
      </div>
    </AppShell>
  );
}
