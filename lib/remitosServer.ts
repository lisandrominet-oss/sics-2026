import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { hasModule } from "@/lib/modules";
import { untyped, type RemitoRole } from "@/lib/remitos";

// Guarda común de las páginas del módulo Remitos: sesión, módulo habilitado y rol interno (la base manda).
export async function requireRemitos() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  if (!hasModule(profile, "remitos")) redirect("/dashboard");

  const supabase = untyped(createClient());
  const { data } = await supabase.rpc("remito_role");
  const role = (data as RemitoRole | null) ?? null;
  if (!role) redirect("/dashboard");
  return { profile, supabase, role };
}
