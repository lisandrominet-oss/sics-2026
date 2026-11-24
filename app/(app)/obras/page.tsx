import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import ObrasList from "@/components/obras/ObrasList";
import type { ObraAccess } from "@/lib/obras";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ObrasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");

  const supabase = createClient();
  const { data: access } = await supabase.rpc("obras_access");
  if (!access) redirect("/dashboard");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, code, active, source, imported_at, project_nodes(count)")
    .order("name");

  const rows = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    active: p.active,
    importedAt: p.imported_at,
    nodeCount: (p.project_nodes as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Obras"
        description="El plan de cada obra, importado desde Primavera. Al cargar una SIC se elige a qué ítem de la obra corresponde."
      />
      <ObrasList rows={rows} canEdit={(access as ObraAccess) === "editar"} />
    </div>
  );
}
