import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import { effectiveRole } from "@/lib/constants";
import ConfigForm from "@/components/ConfigForm";

export default async function ConfigPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data: settings } = await supabase.from("app_settings").select("*");

  const threshold = settings?.find((s) => s.key === "gerencia_approval_threshold_ars")?.value as number | undefined;
  const domains = settings?.find((s) => s.key === "allowed_email_domains")?.value as string[] | undefined;

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Sistema"
          title="Configuración"
          description="Ajustá el monto tope para aprobación de Gerencia y los dominios de email habilitados para iniciar sesión."
        />
        <div className="mt-6">
          <ConfigForm threshold={threshold ?? 500000} domains={domains ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
