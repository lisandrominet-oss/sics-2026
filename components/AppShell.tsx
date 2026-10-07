"use client";

import { useEffect, useRef, useState } from "react";
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
  IconMenu,
  IconPackage,
  IconPlusCircle,
  IconSettings,
  IconTruck,
  IconUsers,
  IconX,
} from "@/components/icons";
import { CAN_CREATE_SIC, ROLE_LABELS, type UserRole } from "@/lib/constants";
import { DEMO_MODULE_ROLES } from "@/lib/modules";
import { cn } from "@/lib/cn";

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
          : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-strong"
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Menú lateral en móvil (drawer): se cierra al navegar, con Escape y al pasar a escritorio.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const button = menuButtonRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Mientras el menú está abierto, lo de atrás no recibe foco ni toques de lector de pantalla.
    const behind = [headerRef.current, contentRef.current] as Array<(HTMLElement & { inert: boolean }) | null>;
    behind.forEach((el) => el && (el.inert = true));
    // Con un pequeño retraso: recién cuando arranca la transición el menú deja de ser `visibility: hidden` y acepta foco.
    const focusTimer = setTimeout(
      () => drawerRef.current?.querySelector<HTMLElement>("a[href], button")?.focus(),
      50
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      behind.forEach((el) => el && (el.inert = false));
      button?.focus();
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      <InactivityGuard />

      {/* Barra superior: solo en móvil. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 pb-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[calc(0.5rem+env(safe-area-inset-top))] lg:hidden dark:border-b dark:border-white/10"
      >
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="menu-lateral"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-fg hover:bg-white/5 hover:text-white"
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" aria-label="Servicios Industriales: ir al Tablero" className="flex h-11 items-center">
          <img src="/brand/logo-completo-negativo.svg" alt="" className="h-9 w-auto" />
        </Link>
        <NotificationsBell userId={userId} variant="bar" />
      </header>

      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden",
          menuOpen ? "opacity-100 duration-base" : "pointer-events-none opacity-0 duration-fast"
        )}
      />

      <aside
        id="menu-lateral"
        ref={drawerRef}
        // Un toque en cualquier enlace del menú lo cierra, aunque sea la página actual.
        onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-slate-900 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-pop transition-[transform,visibility] ease-out-expo",
          menuOpen ? "visible translate-x-0 duration-base" : "invisible -translate-x-full duration-fast",
          "lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:self-start lg:px-4 lg:py-6 lg:shadow-none lg:transition-none dark:lg:border-r dark:lg:border-white/10"
        )}
      >
        <div className="flex items-start justify-between">
          <Link href="/dashboard" className="block px-2" aria-label="Servicios Industriales: ir al Tablero">
            <img src="/brand/logo-completo-negativo.svg" alt="" className="h-14 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-fg hover:bg-white/5 hover:text-white lg:hidden"
          >
            <IconX />
          </button>
        </div>

        <div className="mt-6 hidden lg:block">
          <NotificationsBell userId={userId} />
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-subtle">
            Principal
          </p>
          <NavLink href="/dashboard" label="Tablero" icon={<IconGrid />} />
          {CAN_CREATE_SIC.includes(role) && (
            <NavLink href="/sic/nueva" label="Nueva SIC" icon={<IconPlusCircle />} />
          )}

          {(role === "compras" || role === "admin") && (
            <>
              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-subtle">
                Compras
              </p>
              <NavLink href="/proveedores" label="Proveedores" icon={<IconTruck />} />
              <NavLink href="/contratos" label="Contratos" icon={<IconFileText />} />
            </>
          )}

          {(DEMO_MODULE_ROLES as readonly string[]).includes(role) && (
            <>
              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-subtle">
                Módulos
              </p>
              <NavLink href="/modulos/recursos-humanos" label="Recursos Humanos" icon={<IconBadge />} />
              <NavLink href="/modulos/logistica" label="Logística" icon={<IconPackage />} />
              <NavLink href="/modulos/administracion" label="Administración" icon={<IconBarChart />} />
            </>
          )}

          {role === "gerencia" && (
            <>
              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-subtle">
                Sistema
              </p>
              <NavLink href="/usuarios" label="Usuarios" icon={<IconUsers />} />
            </>
          )}

          {role === "admin" && (
            <>
              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-subtle">
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
              <p className="truncate text-xs text-sidebar-muted">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <div className="px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div ref={contentRef} className="min-w-0 flex-1">
        <main className="pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-10">
          <div className="animate-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
