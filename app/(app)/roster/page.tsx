import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import RosterGrid from "@/components/RosterGrid";
import RosterTabs from "@/components/RosterTabs";
import { buttonClass } from "@/components/ui/Button";
import { hasModule } from "@/lib/modules";
import { addDays, isIsoDate, todayIso } from "@/lib/roster";
import { fetchAllRows } from "@/lib/rosterData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = [14, 28, 42, 56];

export default async function RosterPage({ searchParams }: { searchParams: { sitio?: string; desde?: string; dias?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "roster")) redirect("/dashboard");

  const supabase = createClient();
  const { data: sites, error: sitesError } = await supabase.from("roster_sites").select("*").order("name");
  if (sitesError) throw new Error(sitesError.message);

  const header = (
    <>
      <PageHeader
        eyebrow="Módulos"
        title="Roster"
        description="Calendario de rotaciones: quién está en sitio, quién de franco y cuándo suben y bajan."
      />
      <RosterTabs active="calendario" />
    </>
  );

  const site = (sites ?? []).find((s) => s.id === searchParams.sitio) ?? (sites ?? []).find((s) => s.active) ?? (sites ?? [])[0];
  if (!site) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6">
          <EmptyState
            title="Todavía no hay sitios cargados"
            description="Empezá por Configuración: creá un sitio, un régimen de rotación (por ejemplo 14x14) y los puestos. Después asigná a las personas."
            action={
              <Link href="/roster/configuracion" className={buttonClass()}>
                Ir a Configuración
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const requestedDays = Number(searchParams.dias);
  const days = PERIODS.includes(requestedDays) ? requestedDays : 28;
  const today = todayIso();
  const from = isIsoDate(searchParams.desde) ? searchParams.desde : today;
  const to = addDays(from, days - 1);

  const [states, assignments, allExceptions] = await Promise.all([
    fetchAllRows((a, b) => supabase.rpc("roster_state", { p_from: from, p_to: to, p_site_id: site.id }).range(a, b)),
    fetchAllRows((a, b) => supabase.rpc("roster_assignments_list", { p_site_id: site.id, p_from: from, p_to: to }).range(a, b)),
    fetchAllRows((a, b) => supabase.from("roster_exceptions").select("*").lte("date_from", to).gte("date_to", from).order("id").range(a, b)),
  ]);
  // Al navegador solo llegan las excepciones (y sus notas) de la gente de este sitio.
  const people = new Set(assignments.map((a) => a.employee_id));
  const exceptions = allExceptions.filter((x) => people.has(x.employee_id));

  return (
    <div className="mx-auto max-w-[96rem]">
      {header}
      <div className="mt-6">
        <RosterGrid
          sites={sites ?? []}
          siteId={site.id}
          from={from}
          days={days}
          today={today}
          assignments={assignments}
          states={states}
          exceptions={exceptions}
        />
      </div>
    </div>
  );
}
