import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import RosterConfig from "@/components/RosterConfig";
import RosterTabs from "@/components/RosterTabs";
import { hasModule } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RosterConfiguracionPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "roster")) redirect("/dashboard");

  const supabase = createClient();
  const [sites, patterns, positions, crews] = await Promise.all([
    supabase.from("roster_sites").select("*").order("name"),
    supabase.from("roster_patterns").select("*").order("name"),
    supabase.from("roster_positions").select("*").order("name"),
    supabase.from("roster_crews").select("*").order("name"),
  ]);
  for (const r of [sites, patterns, positions, crews]) if (r.error) throw new Error(r.error.message);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Módulos" title="Roster" description="Sitios, regímenes de rotación, puestos con dotación requerida y cuadrillas." />
      <RosterTabs active="configuracion" />
      <div className="mt-6">
        <RosterConfig
          sites={sites.data ?? []}
          patterns={patterns.data ?? []}
          positions={positions.data ?? []}
          crews={crews.data ?? []}
        />
      </div>
    </div>
  );
}
