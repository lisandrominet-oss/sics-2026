import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
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
    <div>
      <Nav
        role={role}
        realRole={profile.role}
        userId={profile.id}
        actingAsRole={profile.acting_as_role}
        fullName={profile.full_name}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">Nueva solicitud interna de compra</h1>
        <p className="mt-1 text-sm text-slate-500">
          Completá los datos de tu solicitud. Compras la va a revisar y buscar cotizaciones.
        </p>
        <div className="mt-6">
          <NuevaSicForm
            plants={plants ?? []}
            projects={projects ?? []}
            defaultPlantId={profile.plant_id}
            lockPlant={role === "area"}
          />
        </div>
      </main>
    </div>
  );
}
