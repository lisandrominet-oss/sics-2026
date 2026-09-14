import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ProjectsManager from "@/components/ProjectsManager";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("name");

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
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Proyectos</h1>
        <p className="mt-2 text-sm text-slate-500">
          Lista global de proyectos para los que se puede pedir una compra. Si hay uno solo se
          selecciona automático; si hay más de uno, el jefe de área elige al crear la SIC.
        </p>
        <div className="mt-6">
          <ProjectsManager projects={projects ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
