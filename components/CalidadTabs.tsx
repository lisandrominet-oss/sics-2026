import Link from "next/link";

export type CalidadTabKey = "proyectos" | "plantillas";

// Pestañas del módulo Calidad (mismo estilo que Remitos y Roster).
export default function CalidadTabs({ active }: { active: CalidadTabKey | null }) {
  const tabs = [
    { key: "proyectos", href: "/calidad", label: "Proyectos" },
    { key: "plantillas", href: "/calidad/plantillas", label: "Plantillas y permisos" },
  ] as const;
  return (
    <nav aria-label="Calidad" className="mt-6 flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
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
