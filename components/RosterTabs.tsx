import Link from "next/link";

const TABS = [
  { key: "calendario", href: "/roster", label: "Calendario" },
  { key: "asignaciones", href: "/roster/asignaciones", label: "Asignaciones" },
  { key: "horas", href: "/roster/horas", label: "Horas" },
  { key: "configuracion", href: "/roster/configuracion", label: "Configuración" },
] as const;

export type RosterTabKey = (typeof TABS)[number]["key"];

// Pestañas del módulo Roster (mismo estilo que las de Contratos).
export default function RosterTabs({ active }: { active: RosterTabKey }) {
  return (
    <nav aria-label="Roster" className="mt-6 flex gap-6 overflow-x-auto border-b border-slate-200">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors duration-fast ease-out-expo ${
            t.key === active ? "border-ink font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
