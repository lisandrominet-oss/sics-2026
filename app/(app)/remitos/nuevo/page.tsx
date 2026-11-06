import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import RemitosTabs from "@/components/RemitosTabs";
import RemitoDispatchEditor from "@/components/RemitoDispatchEditor";
import { CAN, normItem, type RemitoProject } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoDespachoPage() {
  const { supabase, role } = await requireRemitos();
  if (!CAN.armarDespachos(role)) redirect("/remitos");

  const [{ data: projects, error: pe }, { data: items, error: ie }] = await Promise.all([
    supabase.from("remito_projects").select("id, code, name, active").eq("active", true).order("code"),
    supabase
      .from("remito_items")
      .select("id, code, description, rubric, unit, category, stock, quality_status, quality_by_name, quality_at, active")
      .eq("active", true)
      .eq("quality_status", "aprobado")
      .order("code"),
  ]);
  if (pe) throw new Error(pe.message);
  if (ie) throw new Error(ie.message);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Remitos y Despachos" title="Nuevo despacho" description="Armado de camión: cabecera, carga y candados de salida." />
      <RemitosTabs active="nuevo" role={role} />
      <RemitoDispatchEditor projects={(projects ?? []) as RemitoProject[]} items={(items ?? []).map(normItem)} />
    </div>
  );
}
