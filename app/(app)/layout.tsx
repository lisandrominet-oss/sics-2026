import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { effectiveRole } from "@/lib/constants";
import { enabledModules } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import FileDropGuard from "@/components/FileDropGuard";

// Menú y marco compartidos por todas las pantallas con sesión: el menú queda montado al navegar
// (antes cada página renderizaba su propio AppShell y el menú se perdía mientras cargaba).
// Esto NO es el control de acceso: cada página sigue validando su rol y las RPC/RLS mandan.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;
  // Obras no es un módulo por usuario: lo editan las áreas que administran obras (Ingeniería) y el admin,
  // y lo ven Gerencia y Compras. Lo decide la base.
  const { data: obrasAccess } = await createClient().rpc("obras_access");

  return (
    <AppShell
      role={role}
      modules={enabledModules(profile)}
      showObras={!!obrasAccess}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      <FileDropGuard />
      {children}
    </AppShell>
  );
}
