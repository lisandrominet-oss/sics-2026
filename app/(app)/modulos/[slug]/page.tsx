import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import ModuleSections from "@/components/ModuleSections";
import { DEMO_MODULES, hasModule, isModuleKey } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: { slug: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");

  const mod = DEMO_MODULES.find((m) => m.slug === params.slug);
  if (!mod || !isModuleKey(mod.slug)) notFound();
  if (!hasModule(profile, mod.slug)) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Módulos" title={mod.title} description={mod.description} />
      <div className="mt-6">
        <ModuleSections sections={mod.sections} />
      </div>
    </div>
  );
}
