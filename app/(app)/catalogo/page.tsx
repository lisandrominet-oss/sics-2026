import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import CatalogManager from "@/components/CatalogManager";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: items } = await supabase
    .from("item_catalog")
    .select("id, name, active, uses_count, last_used_at")
    .order("uses_count", { ascending: false })
    .order("name");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Compras"
        title="Catálogo de artículos"
        description="Artículos que se sugieren mientras se escribe una solicitud. Se completa solo con lo que se va pidiendo; acá podés corregir nombres, agregar consumibles o desactivar los que no deban sugerirse."
      />
      <div className="mt-6">
        <CatalogManager items={items ?? []} />
      </div>
    </div>
  );
}
