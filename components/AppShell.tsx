"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import RoleSwitcher from "@/components/RoleSwitcher";
import NotificationsBell from "@/components/NotificationsBell";
import {
  IconBuilding,
  IconFolder,
  IconGrid,
  IconPlusCircle,
  IconSettings,
  IconUsers,
} from "@/components/icons";
import { CAN_CREATE_SIC, ROLE_LABELS, type UserRole } from "@/lib/constants";

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

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
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      {icon}
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
  pendingCount = 0,
  children,
}: {
  role: UserRole;
  realRole: UserRole;
  userId: string;
  actingAsRole: UserRole | null;
  fullName: string | null;
  pendingCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex w-full shrink-0 flex-col bg-slate-900 px-4 py-6 lg:min-h-screen lg:w-64">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
            SC
          </div>
          <span className="text-sm font-semibold leading-tight text-white">
            Sistema de
            <br />
            Compras
          </span>
        </Link>

        <div className="mt-6">
          <NotificationsBell role={role} userId={userId} pendingCount={pendingCount} />
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Principal
          </p>
          <NavLink href="/dashboard" label="Tablero" icon={<IconGrid />} />
          {CAN_CREATE_SIC.includes(role) && (
            <NavLink href="/sic/nueva" label="Nueva SIC" icon={<IconPlusCircle />} />
          )}

          {role === "admin" && (
            <>
              <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Administración
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
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
              {initials(fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{fullName ?? "Usuario"}</p>
              <p className="truncate text-xs text-slate-400">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <div className="px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <main className="px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
