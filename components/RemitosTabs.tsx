import Link from "next/link";
import { CAN, type RemitoRole } from "@/lib/remitos";

export type RemitosTabKey = "despachos" | "nuevo" | "items" | "calidad" | "recepcion" | "enobra" | "usuarios";

// Pestañas del módulo Remitos (mismo estilo que Roster); cada rol ve solo las suyas.
// El pañolero de proyecto trabaja con lo que le llega: Recepción y En obra.
export default function RemitosTabs({ active, role }: { active: RemitosTabKey | null; role: RemitoRole }) {
  const deProyecto = role === "panol_proyecto";
  const tabs = [
    { key: "despachos", href: "/remitos", label: "Despachos", show: !deProyecto },
    { key: "nuevo", href: "/remitos/nuevo", label: "Nuevo despacho", show: CAN.armarDespachos(role) },
    { key: "recepcion", href: "/remitos/recepcion", label: "Recepción", show: true },
    { key: "enobra", href: "/remitos/en-obra", label: "En obra", show: true },
    { key: "items", href: "/remitos/items", label: "Ítems y Calidad", show: !deProyecto },
    { key: "calidad", href: "/remitos/calidad", label: "Aprobar despachos", show: CAN.verAprobar(role) },
    { key: "usuarios", href: "/remitos/usuarios", label: "Usuarios", show: CAN.gestionarUsuarios(role) },
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
