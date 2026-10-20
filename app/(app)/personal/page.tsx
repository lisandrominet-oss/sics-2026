import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmployeesList from "@/components/EmployeesList";
import { buttonClass } from "@/components/ui/Button";
import { IconPlusCircle, IconUpload } from "@/components/icons";
import { hasModule } from "@/lib/modules";
import { fetchAllEmployees } from "@/lib/employeesData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PersonalPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "personal")) redirect("/dashboard");

  const supabase = createClient();
  const [employees, { data: plants, error: plantsError }] = await Promise.all([
    fetchAllEmployees(supabase),
    supabase.from("plants").select("id, name, prefix").order("name"),
  ]);
  if (plantsError) throw new Error(plantsError.message);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Módulos"
        title="Personal"
        description="Base de datos de los empleados de la empresa: altas, bajas, licencias e importación desde Excel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/personal/importar" className={buttonClass({ variant: "secondary" })}>
              <IconUpload className="h-4 w-4" />
              Importar
            </Link>
            <Link href="/personal/nuevo" className={buttonClass()}>
              <IconPlusCircle className="h-4 w-4" />
              Nuevo empleado
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <EmployeesList employees={employees} plants={plants ?? []} />
      </div>
    </div>
  );
}
