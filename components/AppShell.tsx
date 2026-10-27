"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import RoleSwitcher from "@/components/RoleSwitcher";
import NotificationsBell from "@/components/NotificationsBell";
import InactivityGuard from "@/components/InactivityGuard";
import UserAvatar from "@/components/UserAvatar";
import BrandLogoFull from "@/components/BrandLogoFull";
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
  IconCalendar,
  IconX,
} from "@/components/icons";
import { CAN_CREATE_SIC, ROLE_LABELS, type UserRole } from "@/lib/constants";
import type { ModuleKey } from "@/lib/modules";
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
      className={`group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-base ${
        active
          ? "bg-slate-200 font-medium text-slate-900"
          : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function AppShell({
  role,
  modules,
  realRole,
  userId,
  actingAsRole,
  fullName,
  children,
}: {
  role: UserRole;
  // Módulos habilitados para este usuario (rol + ajustes propios), ya resueltos por el servidor.
  modules: ModuleKey[];
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
  const skipFocusRestoreRef = useRef(false);

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
      // Si se cerró por tocar un enlace, el foco no vuelve a la hamburguesa: la pantalla nueva empieza desde arriba.
      if (!skipFocusRestoreRef.current) button?.focus();
      skipFocusRestoreRef.current = false;
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-frame lg:flex">
      <InactivityGuard />

      {/* Barra superior: solo en móvil. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-30 flex items-center justify-between bg-frame pb-1 pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pt-[calc(0.25rem+env(safe-area-inset-top))] lg:hidden"
      >
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="menu-lateral"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/5 hover:text-slate-900"
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" aria-label="Servicios Industriales: ir al Tablero" className="flex h-11 items-center">
          <img src="/brand/isotipo-color.svg" alt="" className="h-7 w-auto" />
        </Link>
        <NotificationsBell userId={userId} variant="bar" />
      </header>

      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-scrim/50 transition-opacity lg:hidden",
          menuOpen ? "opacity-100 duration-base" : "pointer-events-none opacity-0 duration-fast"
        )}
      />

      <aside
        id="menu-lateral"
        ref={drawerRef}
        // Un toque en cualquier enlace del menú lo cierra, aunque sea la página actual.
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("a")) return;
          skipFocusRestoreRef.current = true;
          setMenuOpen(false);
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-sheet px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pt-[calc(1rem+env(safe-area-inset-top))] shadow-pop transition-[transform,visibility] ease-out-expo",
          menuOpen ? "visible translate-x-0 duration-base" : "invisible -translate-x-full duration-fast",
          "lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-60 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:self-start lg:border-r-0 lg:bg-frame lg:px-3 lg:pb-3 lg:pt-4 lg:shadow-none lg:transition-none"
        )}
      >
        <div className="flex items-start justify-between">
          <Link href="/dashboard" className="block px-1" aria-label="Servicios Industriales: ir al Tablero">
            <BrandLogoFull className="h-11 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/5 hover:text-slate-900 lg:hidden"
          >
            <IconX />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5">
          <p className="px-2.5 pb-1 text-xs text-slate-500">Principal</p>
          <NavLink href="/dashboard" label="Tablero" icon={<IconGrid />} />
          {CAN_CREATE_SIC.includes(role) && (
            <NavLink href="/sic/nueva" label="Nueva SIC" icon={<IconPlusCircle />} />
          )}

          {(modules.includes("proveedores") || modules.includes("catalogo") || modules.includes("contratos")) && (
            <>
              <p className="!mt-5 px-2.5 pb-1 text-xs text-slate-500">Compras</p>
              {modules.includes("proveedores") && (
                <NavLink href="/proveedores" label="Proveedores" icon={<IconTruck />} />
              )}
              {modules.includes("catalogo") && (
                <NavLink href="/catalogo" label="Catálogo" icon={<IconPackage />} />
              )}
              {modules.includes("contratos") && (
                <NavLink href="/contratos" label="Contratos" icon={<IconFileText />} />
              )}
            </>
          )}

          {(modules.includes("personal") || modules.includes("roster") || modules.includes("recursos-humanos") || modules.includes("logistica") || modules.includes("administracion")) && (
            <>
              <p className="!mt-5 px-2.5 pb-1 text-xs text-slate-500">Módulos</p>
              {modules.includes("personal") && (
                <NavLink href="/personal" label="Personal" icon={<IconUsers />} />
              )}
              {modules.includes("roster") && (
                <NavLink href="/roster" label="Roster" icon={<IconCalendar />} />
              )}
              {modules.includes("recursos-humanos") && (
                <NavLink href="/modulos/recursos-humanos" label="Recursos Humanos" icon={<IconBadge />} />
              )}
              {modules.includes("logistica") && (
                <NavLink href="/modulos/logistica" label="Logística" icon={<IconPackage />} />
              )}
              {modules.includes("administracion") && (
                <NavLink href="/modulos/administracion" label="Administración" icon={<IconBarChart />} />
              )}
            </>
          )}

          {role === "gerencia" && (
            <>
              <p className="!mt-5 px-2.5 pb-1 text-xs text-slate-500">Sistema</p>
              <NavLink href="/usuarios" label="Usuarios" icon={<IconUsers />} />
            </>
          )}

          {role === "admin" && (
            <>
              <p className="!mt-5 px-2.5 pb-1 text-xs text-slate-500">Sistema</p>
              <NavLink href="/admin/usuarios" label="Usuarios" icon={<IconUsers />} />
              <NavLink href="/admin/plantas" label="Plantas" icon={<IconBuilding />} />
              <NavLink href="/admin/proyectos" label="Proyectos" icon={<IconFolder />} />
              <NavLink href="/admin/config" label="Configuración" icon={<IconSettings />} />
            </>
          )}
        </nav>

        <div className="mt-5 space-y-3 border-t border-slate-200 pt-3 lg:border-slate-300/70">
          {realRole === "admin" && <RoleSwitcher userId={userId} actingAsRole={actingAsRole} />}
          <Link
            href="/preferencias"
            title={fullName ? `${fullName}: Preferencias` : "Preferencias"}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-900/5"
          >
            <UserAvatar userId={userId} fullName={fullName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{fullName ?? "Usuario"}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
          </Link>
          <div className="px-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div ref={contentRef} className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior de escritorio: sobre el marco, sin línea. Hoy solo lleva las notificaciones. */}
        <div className="sticky top-0 z-20 hidden h-12 shrink-0 items-center justify-end bg-frame px-4 lg:flex">
          <NotificationsBell userId={userId} variant="bar" />
        </div>
        {/* La hoja: en móvil ocupa el ancho con las esquinas de arriba redondeadas; en escritorio queda a 8 px del borde. */}
        <main className="flex-1 rounded-t-2xl border-slate-200 bg-sheet pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:mb-2 lg:mr-2 lg:rounded-2xl lg:border lg:px-8 lg:pt-7">
          {/* Con `key` por ruta el fade de entrada se repite al cambiar de pantalla (el shell ya no se remonta);
              al llegar la página real desde su `loading.tsx` la ruta es la misma y no vuelve a animar. */}
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
