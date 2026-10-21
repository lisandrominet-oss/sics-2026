import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import RosterHours from "@/components/RosterHours";
import RosterTabs from "@/components/RosterTabs";
import { hasModule } from "@/lib/modules";
import { addDays, daysBetween, isIsoDate, monthBounds, todayIso } from "@/lib/roster";
import { fetchAllRows } from "@/lib/rosterData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RosterHorasPage({ searchParams }: { searchParams: { sitio?: string; desde?: string; hasta?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "roster")) redirect("/dashboard");

  const today = todayIso();
  const month = monthBounds(today);
  const from = isIsoDate(searchParams.desde) ? searchParams.desde : month.from;
  let to = isIsoDate(searchParams.hasta) && searchParams.hasta >= from ? searchParams.hasta : month.to > from ? month.to : from;
  // La base calcula hasta 62 días por vez.
  if (daysBetween(from, to) > 61) to = addDays(from, 61);

  const supabase = createClient();
  const { data: sites, error: sitesError } = await supabase.from("roster_sites").select("*").order("name");
  if (sitesError) throw new Error(sitesError.message);
  const siteId = (sites ?? []).some((s) => s.id === searchParams.sitio) ? searchParams.sitio! : "";

  const [rows, costs, closures] = await Promise.all([
    fetchAllRows((a, b) => supabase.rpc("roster_hours_summary", { p_from: from, p_to: to, p_site_id: siteId || undefined }).range(a, b)),
    fetchAllRows((a, b) => supabase.rpc("roster_cost_summary", { p_from: from, p_to: to, p_site_id: siteId || undefined }).range(a, b)),
    supabase.from("roster_closures").select("*").order("date_from", { ascending: false }).order("id").limit(50),
  ]);
  if (closures.error) throw new Error(closures.error.message);

  return (
    <div className="mx-auto max-w-[96rem]">
      <PageHeader
        eyebrow="Módulos"
        title="Roster"
        description="Horas y días trabajados por persona en un período, con recargos y costo: el insumo para liquidar."
      />
      <RosterTabs active="horas" />
      <div className="mt-6">
        <RosterHours sites={sites ?? []} siteId={siteId} from={from} to={to} today={today} rows={rows} costs={costs} closures={closures.data ?? []} />
      </div>
    </div>
  );
}
