import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import AssignmentsManager from "@/components/AssignmentsManager";
import RosterTabs from "@/components/RosterTabs";
import { hasModule } from "@/lib/modules";
import { fetchAllRows } from "@/lib/rosterData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RosterAsignacionesPage({ searchParams }: { searchParams: { historial?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "roster")) redirect("/dashboard");

  const showHistory = searchParams.historial === "1";
  const supabase = createClient();
  const [sites, patterns, positions, crews, options, assignments] = await Promise.all([
    supabase.from("roster_sites").select("*").order("name"),
    supabase.from("roster_patterns").select("*").order("name"),
    supabase.from("roster_positions").select("*").order("name"),
    supabase.from("roster_crews").select("*").order("name"),
    fetchAllRows((a, b) => supabase.rpc("roster_employee_options").range(a, b)),
    fetchAllRows((a, b) => supabase.rpc("roster_assignments_list", { p_only_current: !showHistory }).range(a, b)),
  ]);
  for (const r of [sites, patterns, positions, crews]) if (r.error) throw new Error(r.error.message);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Módulos"
        title="Roster"
        description="Quién rota en cada sitio, con qué régimen, desde qué fecha de inicio del ciclo y en qué turno."
      />
      <RosterTabs active="asignaciones" />
      <div className="mt-6">
        <AssignmentsManager
          sites={sites.data ?? []}
          patterns={patterns.data ?? []}
          positions={positions.data ?? []}
          crews={crews.data ?? []}
          options={options}
          assignments={assignments}
          showHistory={showHistory}
        />
      </div>
    </div>
  );
}
