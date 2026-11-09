import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { hasModule } from "@/lib/modules";
import { untyped, type CalRole } from "@/lib/calidad";

// Guarda común de las páginas del módulo Calidad: sesión, módulo habilitado y rol interno (la base manda).
export async function requireCalidad() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "calidad")) redirect("/dashboard");

  const supabase = untyped(createClient());
  const { data } = await supabase.rpc("cal_role");
  const role = (data as CalRole | null) ?? null;
  if (!role) redirect("/dashboard");
  return { profile, supabase, role };
}
