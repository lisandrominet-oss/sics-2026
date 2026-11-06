import PageHeader from "@/components/ui/PageHeader";
import RemitosTabs from "@/components/RemitosTabs";
import RemitoItemsManager from "@/components/RemitoItemsManager";
import { normItem } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RemitoItemsPage() {
  const { supabase, role } = await requireRemitos();
  const { data, error } = await supabase
    .from("remito_items")
    .select("id, code, description, rubric, unit, category, stock, quality_status, quality_by_name, quality_at, active")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title="Ítems y liberación de Calidad"
        description="Solo los ítems aprobados pueden cargarse en un camión. Calidad libera o rechaza desde acá."
      />
      <RemitosTabs active="items" role={role} />
      <RemitoItemsManager items={(data ?? []).map(normItem)} role={role} />
    </div>
  );
}
