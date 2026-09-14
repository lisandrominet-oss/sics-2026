import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import UsersTable from "@/components/UsersTable";
import ProvisioningManager from "@/components/ProvisioningManager";

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const [{ data: profiles }, { data: plants }, { data: provisioning }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("plants").select("id, name, prefix").order("name"),
    supabase.from("user_provisioning").select("*").order("created_at"),
  ]);

  return (
    <AppShell
      role={profile.role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Administración</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="mt-2 text-sm text-slate-500">
          Asigná rol, área/departamento y planta a cada usuario que inició sesión.
        </p>
        <div className="mt-6">
          <UsersTable profiles={profiles ?? []} plants={plants ?? []} currentUserId={profile.id} />
        </div>

        <div className="mt-8">
          <ProvisioningManager entries={provisioning ?? []} plants={plants ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
