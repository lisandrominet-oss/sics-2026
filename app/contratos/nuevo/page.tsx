import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import ContractForm from "@/components/ContractForm";
import { effectiveRole } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NuevoContratoPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  if (role !== "compras" && role !== "admin") redirect("/dashboard");

  const supabase = createClient();

  const [{ data: providers }, { data: plants }, { data: projects }] = await Promise.all([
    supabase.from("providers").select("id, name").eq("active", true).order("name"),
    supabase.from("plants").select("id, name, prefix").eq("active", true).order("name"),
    supabase.from("projects").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compras</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nuevo contrato</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cargá el proveedor, las fechas y los equipos alquilados con su tarifa.
        </p>
        <div className="mt-6">
          <ContractForm providers={providers ?? []} plants={plants ?? []} projects={projects ?? []} />
        </div>
      </div>
    </AppShell>
  );
}
