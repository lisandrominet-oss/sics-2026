import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { effectiveRole } from "@/lib/constants";
import AppShell from "@/components/AppShell";

// Menú y marco compartidos por todas las pantallas con sesión: el menú queda montado al navegar
// (antes cada página renderizaba su propio AppShell y el menú se perdía mientras cargaba).
// Esto NO es el control de acceso: cada página sigue validando su rol y las RPC/RLS mandan.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.role) redirect("/login");
  const role = effectiveRole(profile)!;

  return (
    <AppShell
      role={role}
      realRole={profile.role}
      userId={profile.id}
      actingAsRole={profile.acting_as_role}
      fullName={profile.full_name}
    >
      {children}
    </AppShell>
  );
}
