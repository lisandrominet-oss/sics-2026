import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import EmployeeDetail from "@/components/EmployeeDetail";
import { IconArrowLeft } from "@/components/icons";
import { hasModule } from "@/lib/modules";
import { fetchSuggestions } from "@/lib/employeesData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EmpleadoPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "personal")) redirect("/dashboard");
  if (!UUID.test(params.id)) notFound();

  const supabase = createClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("*, plant:plants(name, prefix)")
    .eq("id", params.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!employee) notFound();

  const [{ data: events, error: eventsError }, { data: plants, error: plantsError }, suggestions] = await Promise.all([
    supabase
      .from("employee_events")
      .select("*, actor:profiles(full_name)")
      .eq("employee_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("plants").select("id, name, prefix, active").order("name"),
    fetchSuggestions(supabase),
  ]);
  // Un historial vacío por un error de consulta se vería como "sin movimientos": mejor fallar a la vista.
  if (eventsError) throw new Error(eventsError.message);
  if (plantsError) throw new Error(plantsError.message);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/personal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <IconArrowLeft />
        Personal
      </Link>
      <EmployeeDetail
        employee={employee}
        events={events ?? []}
        plants={plants ?? []}
        suggestions={suggestions}
      />
    </div>
  );
}
