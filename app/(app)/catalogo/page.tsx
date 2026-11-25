import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import CatalogManager from "@/components/CatalogManager";
import { hasModule } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "catalogo")) redirect("/dashboard");

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
        info="Son los artículos que se sugieren al escribir una solicitud. Se completa solo con lo que se va pidiendo; acá se corrigen nombres o se desactivan sugerencias."
      />
      <div className="mt-6">
        <CatalogManager items={items ?? []} />
      </div>
    </div>
  );
}
