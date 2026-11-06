import Link from "next/link";
import { CAN, type RemitoRole } from "@/lib/remitos";

export type RemitosTabKey = "despachos" | "nuevo" | "items" | "calidad";

// Pestañas del módulo Remitos (mismo estilo que Roster); se muestran las que el rol interno puede usar.
export default function RemitosTabs({ active, role }: { active: RemitosTabKey | null; role: RemitoRole }) {
  const tabs = [
    { key: "despachos", href: "/remitos", label: "Despachos", show: true },
    { key: "nuevo", href: "/remitos/nuevo", label: "Nuevo despacho", show: CAN.armarDespachos(role) },
    { key: "items", href: "/remitos/items", label: "Ítems y Calidad", show: true },
    { key: "calidad", href: "/remitos/calidad", label: "Aprobar despachos", show: CAN.verAprobar(role) },
  ] as const;

  return (
    <nav aria-label="Remitos" className="mt-6 flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs
        .filter((t) => t.show)
        .map((t) => (
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
