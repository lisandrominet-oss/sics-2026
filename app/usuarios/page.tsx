import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
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
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistema</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="mt-2 text-sm text-slate-500">
          Altas, bajas y cambios de la gente de la empresa: rol, cargo y área. Pausar a alguien le quita el acceso
          sin borrar su historial.
        </p>
        <div className="mt-6">
          <StaffUsersManager
            users={users ?? []}
            pending={pending ?? []}
            plants={plants ?? []}
            currentUserId={profile.id}
          />
        </div>
      </div>
    </AppShell>
  );
}
