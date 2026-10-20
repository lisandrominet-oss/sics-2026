import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmployeeForm from "@/components/EmployeeForm";
import { hasModule } from "@/lib/modules";
import { fetchSuggestions } from "@/lib/employeesData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoEmpleadoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "personal")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: plants }, suggestions] = await Promise.all([
    supabase.from("plants").select("id, name, prefix, active").order("name"),
    fetchSuggestions(supabase),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Personal" title="Nuevo empleado" description="Cargá los datos base del legajo. Después se pueden editar." />
      <div className="mt-6">
        <EmployeeForm plants={plants ?? []} suggestions={suggestions} />
      </div>
    </div>
  );
}
