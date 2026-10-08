import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import StaffUsersManager from "@/components/StaffUsersManager";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Gestión de usuarios para Gerencia. Los administradores no aparecen: solo los ve el admin.
export default async function UsuariosGerenciaPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role === "admin") redirect("/admin/usuarios");
  if (role !== "gerencia") redirect("/dashboard");

  const supabase = createClient();
  const [{ data: users }, { data: pending }, { data: plants }] = await Promise.all([
    supabase.from("profiles").select("*").or("role.is.null,role.neq.admin").order("created_at"),
    supabase.from("user_provisioning").select("*").neq("role", "admin").order("created_at"),
    supabase.from("plants").select("id, name, prefix").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Sistema"
        title="Usuarios"
        description="Altas, bajas y cambios de la gente de la empresa: rol, cargo y área. Pausar a alguien le quita el acceso sin borrar su historial."
      />
      <div className="mt-6">
        <StaffUsersManager
          users={users ?? []}
          pending={pending ?? []}
          plants={plants ?? []}
          currentUserId={profile.id}
        />
      </div>
    </div>
  );
}
