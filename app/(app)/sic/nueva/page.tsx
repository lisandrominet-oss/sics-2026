import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import NuevaSicForm from "@/components/NuevaSicForm";
import { CAN_CREATE_SIC, effectiveRole } from "@/lib/constants";

export default async function NuevaSicPage({ searchParams }: { searchParams: { proyecto?: string; item?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (!CAN_CREATE_SIC.includes(role)) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: plants }, { data: projects }, { data: catalog }] = await Promise.all([
    supabase.from("plants").select("id, name, prefix").eq("active", true).order("name"),
    supabase.from("projects").select("id, name").eq("active", true).order("name"),
    // Sugerencias del campo Artículo: los más pedidos primero. Si el catálogo supera los mil, pasar a búsqueda en servidor.
    supabase.from("item_catalog").select("name").eq("active", true).order("uses_count", { ascending: false }).order("name").limit(1000),
  ]);

  const canPickPlant = role === "compras" || role === "admin";
  // Desde la pantalla de una obra ("Nueva SIC para este ítem") llegan el proyecto y el ítem ya elegidos.
  const initialProjectId = (projects ?? []).some((p) => p.id === searchParams.proyecto) ? searchParams.proyecto! : "";
  let initialNodeId: string | null = null;
  if (initialProjectId && searchParams.item) {
    const { data: node } = await supabase
      .from("project_nodes")
      .select("id")
      .eq("id", searchParams.item)
      .eq("project_id", initialProjectId)
      .eq("active", true)
      .maybeSingle();
    initialNodeId = node?.id ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nueva solicitud interna de compra" />
      <div className="mt-6">
        <NuevaSicForm
          plants={plants ?? []}
          projects={projects ?? []}
          defaultPlantId={profile.plant_id}
          canPickPlant={canPickPlant}
          catalog={(catalog ?? []).map((c) => c.name)}
          initialProjectId={initialProjectId}
          initialNodeId={initialNodeId}
        />
      </div>
    </div>
  );
}
