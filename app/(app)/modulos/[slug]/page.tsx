import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
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
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Módulos" title={mod.title} description={mod.description} />
      <div className="mt-6">
        <ModuleSections sections={mod.sections} />
      </div>
    </div>
  );
}
