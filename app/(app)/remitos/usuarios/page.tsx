import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import RemitosTabs from "@/components/RemitosTabs";
import RemitoStaffManager, { type StaffProfile, type StaffRow } from "@/components/RemitoStaffManager";
import { CAN, type RemitoProject } from "@/lib/remitos";
import { requireRemitos } from "@/lib/remitosServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsuariosRemitosPage() {
  const { supabase, role } = await requireRemitos();
  if (!CAN.gestionarUsuarios(role)) redirect("/remitos");

  const [{ data: profiles, error: pe }, { data: staff, error: se }, { data: projects, error: je }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, active, module_overrides").eq("active", true).order("full_name"),
    supabase.from("remito_staff").select("user_id, role, project_id, active"),
    supabase.from("remito_projects").select("id, code, name, active").eq("active", true).order("code"),
  ]);
  if (pe) throw new Error(pe.message);
  if (se) throw new Error(se.message);
  if (je) throw new Error(je.message);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Remitos y Despachos"
        title="Usuarios del módulo"
        description="Qué hace cada persona en Remitos. El pañolero de taller es Logística; el pañolero de proyecto recibe lo que le llega y queda ligado a un proyecto; el jefe de área supervisa con Administración."
      />
      <RemitosTabs active="usuarios" role={role} />
      <RemitoStaffManager
        profiles={(profiles ?? []) as StaffProfile[]}
        staff={(staff ?? []) as StaffRow[]}
        projects={(projects ?? []) as RemitoProject[]}
      />
    </div>
  );
}
