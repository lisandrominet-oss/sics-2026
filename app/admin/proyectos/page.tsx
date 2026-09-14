import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import ProjectsManager from "@/components/ProjectsManager";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("name");

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
        <h1 className="text-lg font-semibold text-slate-900">Proyectos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lista global de proyectos para los que se puede pedir una compra. Si hay uno solo se
          selecciona automático; si hay más de uno, el jefe de área elige al crear la SIC.
        </p>
        <div className="mt-6">
          <ProjectsManager projects={projects ?? []} />
        </div>
      </main>
    </div>
  );
}
