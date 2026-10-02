import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ModuleSections from "@/components/ModuleSections";
import { effectiveRole } from "@/lib/constants";
import { DEMO_MODULES, DEMO_MODULE_ROLES } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: { slug: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (!(DEMO_MODULE_ROLES as readonly string[]).includes(role)) redirect("/dashboard");

  const mod = DEMO_MODULES.find((m) => m.slug === params.slug);
  if (!mod) notFound();

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Módulos</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{mod.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{mod.description}</p>
        <div className="mt-6">
          <ModuleSections sections={mod.sections} />
        </div>
      </div>
    </AppShell>
  );
}
