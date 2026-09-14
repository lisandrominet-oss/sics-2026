import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import ConfigForm from "@/components/ConfigForm";

export default async function ConfigPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: settings } = await supabase.from("app_settings").select("*");

  const threshold = settings?.find((s) => s.key === "gerencia_approval_threshold_ars")?.value as number | undefined;
  const domains = settings?.find((s) => s.key === "allowed_email_domains")?.value as string[] | undefined;

  return (
    <div>
      <Nav
        role={profile.role}
        realRole={profile.role}
        userId={profile.id}
        actingAsRole={profile.acting_as_role}
        fullName={profile.full_name}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ajustá el monto tope para aprobación de Gerencia y los dominios de email habilitados para iniciar sesión.
        </p>
        <div className="mt-6">
          <ConfigForm threshold={threshold ?? 500000} domains={domains ?? []} />
        </div>
      </main>
    </div>
  );
}
