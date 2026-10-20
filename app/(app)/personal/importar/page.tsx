import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import EmployeeImport from "@/components/EmployeeImport";
import { hasModule } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImportarPersonalPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "personal")) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Personal"
        title="Importar empleados"
        description="Cargá el padrón completo desde un archivo CSV (en Excel: Guardar como → CSV)."
      />
      <div className="mt-6">
        <EmployeeImport />
      </div>
    </div>
  );
}
