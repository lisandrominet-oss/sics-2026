import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import ProfilePreferences from "@/components/ProfilePreferences";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PreferenciasPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");

  let plantName: string | null = null;
  if (profile.plant_id) {
    const supabase = createClient();
    const { data } = await supabase.from("plants").select("name").eq("id", profile.plant_id).maybeSingle();
    plantName = data?.name ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Preferencias" description="Tu perfil y cómo querés ver el sistema." />
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
  );
}
