import PageHeader from "@/components/ui/PageHeader";
import CalidadTabs from "@/components/CalidadTabs";
import CalidadTemplates from "@/components/CalidadTemplates";
import CalidadStaffManager, { type StaffCandidate } from "@/components/CalidadStaffManager";
import { CAN, type CalTemplate } from "@/lib/calidad";
import { requireCalidad } from "@/lib/calidadServer";
import { ROLE_LABELS as SICS_ROLE_LABELS, type UserRole } from "@/lib/constants";
import { hasModule } from "@/lib/modules";
import type { Json } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalidadPlantillasPage() {
  const { supabase, role } = await requireCalidad();
  const canEdit = CAN.editar(role);

  const { data, error } = await supabase.from("cal_templates").select("id, name, stages, active").order("created_at").order("name");
  if (error) throw new Error(error.message);
  const templates = (data ?? []) as CalTemplate[];

  let people: StaffCandidate[] = [];
  if (CAN.administrarSupervisores(role)) {
    const [{ data: profiles }, { data: staff }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role, module_overrides").eq("active", true).order("full_name"),
      supabase.from("cal_staff").select("user_id, active"),
    ]);
    const supervisors = new Set(((staff ?? []) as { user_id: string; active: boolean }[]).filter((s) => s.active).map((s) => s.user_id));
    people = ((profiles ?? []) as { id: string; full_name: string | null; email: string | null; role: UserRole | null; module_overrides: Json | null }[])
      .filter((p) => p.role)
      .map((p) => ({
        id: p.id,
        name: p.full_name || p.email || "Sin nombre",
        email: p.full_name ? p.email : null,
        roleLabel: p.role ? SICS_ROLE_LABELS[p.role] : "",
        isSupervisor: supervisors.has(p.id),
        isAdmin: p.role === "admin",
        hasModule: hasModule({ role: p.role, module_overrides: p.module_overrides }, "calidad"),
      }));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Módulos"
        title="Plantillas y permisos"
        description="Las etapas que se ofrecen al crear un grupo y quién puede cargar avance."
      />
      <CalidadTabs active="plantillas" />

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900">Plantillas de etapas</h2>
        <div className="mt-3">
          <CalidadTemplates templates={templates} canEdit={canEdit} />
        </div>
      </section>

      {CAN.administrarSupervisores(role) && (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-slate-900">Supervisores de Calidad</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-slate-500">
            Quienes cargan el avance y arman la estructura. El resto de los usuarios con el módulo solo mira.
          </p>
          <div className="mt-3">
            <CalidadStaffManager people={people} />
          </div>
        </section>
      )}
    </div>
  );
}
