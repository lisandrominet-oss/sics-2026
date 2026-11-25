import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import { effectiveRole } from "@/lib/constants";
import ProjectsManager from "@/components/ProjectsManager";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Sistema"
        title="Proyectos"
        info="Si hay un solo proyecto se selecciona automático; si hay más, el jefe de área elige al crear la SIC."
      />
      <div className="mt-6">
        <ProjectsManager projects={projects ?? []} />
      </div>
    </div>
  );
}
