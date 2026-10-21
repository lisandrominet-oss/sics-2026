import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import RosterConfig from "@/components/RosterConfig";
import RosterPayConfig from "@/components/RosterPayConfig";
import RosterTabs from "@/components/RosterTabs";
import { hasModule } from "@/lib/modules";
import { todayIso } from "@/lib/roster";
import { fetchAllRows } from "@/lib/rosterData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RosterConfiguracionPage({ searchParams }: { searchParams: { anio?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "roster")) redirect("/dashboard");

  const requestedYear = Number(searchParams.anio);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : Number(todayIso().slice(0, 4));

  const supabase = createClient();
  const [sites, patterns, positions, crews, holidays, payRules, rules, rates, categories, options] = await Promise.all([
    supabase.from("roster_sites").select("*").order("name"),
    supabase.from("roster_patterns").select("*").order("name"),
    supabase.from("roster_positions").select("*").order("name"),
    supabase.from("roster_crews").select("*").order("name"),
    supabase.from("roster_holidays").select("*").gte("day", `${year}-01-01`).lte("day", `${year}-12-31`).order("day").order("id"),
    supabase.from("roster_pay_rules").select("*").single(),
    supabase.from("roster_rules").select("shift_hours").single(),
    fetchAllRows((a, b) => supabase.rpc("roster_rates_list").range(a, b)),
    supabase.rpc("roster_job_categories"),
    fetchAllRows((a, b) => supabase.rpc("roster_employee_options").range(a, b)),
  ]);
  for (const r of [sites, patterns, positions, crews, holidays, payRules, rules, categories]) if (r.error) throw new Error(r.error.message);
  if (!payRules.data || !rules.data) throw new Error("Faltan las reglas de pago del roster");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Módulos" title="Roster" description="Sitios, regímenes de rotación, puestos, cuadrillas, feriados, reglas de pago y precios por hora." />
      <RosterTabs active="configuracion" />
      <div className="mt-6">
        <RosterConfig
          sites={sites.data ?? []}
          patterns={patterns.data ?? []}
          positions={positions.data ?? []}
          crews={crews.data ?? []}
        />
      </div>
      <div className="mt-6">
        <RosterPayConfig
          sites={sites.data ?? []}
          holidays={holidays.data ?? []}
          payRules={payRules.data}
          shiftHours={rules.data.shift_hours}
          rates={rates}
          categories={(categories.data ?? []).map((c) => c.job_category)}
          options={options}
          year={year}
        />
      </div>
    </div>
  );
}
