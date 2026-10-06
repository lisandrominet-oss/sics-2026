import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ProfilePreferences from "@/components/ProfilePreferences";
import { ROLE_LABELS, effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  let plantName: string | null = null;
  if (profile.plant_id) {
    const supabase = createClient();
    const { data } = await supabase.from("plants").select("name").eq("id", profile.plant_id).maybeSingle();
    plantName = data?.name ?? null;
  }

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sistema de Compras</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Preferencias</h1>
        <p className="mt-2 text-sm text-slate-500">Tu perfil y cómo querés ver el sistema.</p>
        <div className="mt-6">
          <ProfilePreferences
            userId={profile.id}
            fullName={profile.full_name}
            email={profile.email}
            roleLabel={ROLE_LABELS[profile.role]}
            department={profile.department}
            plantName={plantName}
            avatarPath={profile.avatar_path}
          />
        </div>
      </div>
    </AppShell>
  );
}
