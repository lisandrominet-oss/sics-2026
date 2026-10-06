"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import RoleSwitcher from "@/components/RoleSwitcher";
import NotificationsBell from "@/components/NotificationsBell";
import InactivityGuard from "@/components/InactivityGuard";
import UserAvatar from "@/components/UserAvatar";
import {
  IconBadge,
  IconBarChart,
  IconBuilding,
  IconFileText,
  IconFolder,
  IconGrid,
  IconPackage,
  IconPlusCircle,
  IconSettings,
  IconTruck,
  IconUsers,
} from "@/components/icons";
import { CAN_CREATE_SIC, ROLE_LABELS, type UserRole } from "@/lib/constants";
import { DEMO_MODULE_ROLES } from "@/lib/modules";

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-base ${
        active
          ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_#818cf8]"
          : "text-[#94a3b8] hover:bg-white/5 hover:text-[#f1f5f9]"
      }`}
    >
      <span className="transition-transform duration-base ease-out-expo group-hover:scale-110">{icon}</span>
      {label}
    </Link>
  );
}

export default function AppShell({
  role,
  realRole,
  userId,
  actingAsRole,
  fullName,
  children,
}: {
  role: UserRole;
  realRole: UserRole;
  userId: string;
  actingAsRole: UserRole | null;
  fullName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <InactivityGuard />
      <aside className="flex w-full shrink-0 flex-col bg-slate-900 px-4 py-6 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:self-start lg:overflow-y-auto dark:lg:border-r dark:lg:border-white/10">
        <Link href="/dashboard" className="block px-2" aria-label="Servicios Industriales: ir al Tablero">
          <img src="/brand/logo-completo-negativo.svg" alt="" className="h-14 w-auto" />
        </Link>

        <div className="mt-6">
          <NotificationsBell userId={userId} />
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
            Principal
          </p>
          <NavLink href="/dashboard" label="Tablero" icon={<IconGrid />} />
          {CAN_CREATE_SIC.includes(role) && (
            <NavLink href="/sic/nueva" label="Nueva SIC" icon={<IconPlusCircle />} />
          )}

          {(role === "compras" || role === "admin") && (
            <>
              <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                Compras
              </p>
              <NavLink href="/proveedores" label="Proveedores" icon={<IconTruck />} />
              <NavLink href="/contratos" label="Contratos" icon={<IconFileText />} />
            </>
          )}

          {(DEMO_MODULE_ROLES as readonly string[]).includes(role) && (
            <>
              <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                Módulos
              </p>
              <NavLink href="/modulos/recursos-humanos" label="Recursos Humanos" icon={<IconBadge />} />
              <NavLink href="/modulos/logistica" label="Logística" icon={<IconPackage />} />
              <NavLink href="/modulos/administracion" label="Administración" icon={<IconBarChart />} />
            </>
          )}

          {role === "gerencia" && (
            <>
              <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                Sistema
              </p>
              <NavLink href="/usuarios" label="Usuarios" icon={<IconUsers />} />
            </>
          )}

          {role === "admin" && (
            <>
              <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
                Sistema
              </p>
              <NavLink href="/admin/usuarios" label="Usuarios" icon={<IconUsers />} />
              <NavLink href="/admin/plantas" label="Plantas" icon={<IconBuilding />} />
              <NavLink href="/admin/proyectos" label="Proyectos" icon={<IconFolder />} />
              <NavLink href="/admin/config" label="Configuración" icon={<IconSettings />} />
            </>
          )}
        </nav>

        <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
          {realRole === "admin" && <RoleSwitcher userId={userId} actingAsRole={actingAsRole} />}
          <Link
            href="/preferencias"
            title="Preferencias"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
          >
            <UserAvatar userId={userId} fullName={fullName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{fullName ?? "Usuario"}</p>
              <p className="truncate text-xs text-[#94a3b8]">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <div className="px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <main className="px-4 py-8 sm:px-6 lg:px-10">
          <div className="animate-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
