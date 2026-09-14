import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import UsersTable from "@/components/UsersTable";

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const [{ data: profiles }, { data: plants }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("plants").select("id, name, prefix").order("name"),
  ]);

  return (
    <div>
      <Nav
        role={profile.role}
        realRole={profile.role}
        userId={profile.id}
        actingAsRole={profile.acting_as_role}
        fullName={profile.full_name}
      />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">Usuarios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Asigná rol, área/departamento y planta a cada usuario que inició sesión.
        </p>
        <div className="mt-6">
          <UsersTable profiles={profiles ?? []} plants={plants ?? []} currentUserId={profile.id} />
        </div>
      </main>
    </div>
  );
}
