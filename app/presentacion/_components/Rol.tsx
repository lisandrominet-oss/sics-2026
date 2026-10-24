import { cn } from "@/lib/cn";

export type Carril = "emisor" | "jefe" | "compras" | "gerencia" | "panol" | "admin";

// Un color por carril del circuito (mismos tonos que los Badge de la app).
export const CARRIL: Record<Carril, { label: string; clases: string }> = {
  emisor: { label: "Emisor", clases: "bg-slate-100 text-slate-700" },
  jefe: { label: "Jefe de área", clases: "bg-violet-100 text-violet-700" },
  compras: { label: "Compras", clases: "bg-emerald-100 text-emerald-700" },
  gerencia: { label: "Gerencia", clases: "bg-amber-100 text-amber-700" },
  panol: { label: "Pañol", clases: "bg-sky-100 text-sky-700" },
  admin: { label: "Administrador", clases: "bg-indigo-100 text-indigo-700" },
};

export function Rol({ carril, etiqueta, className }: { carril: Carril; etiqueta?: string; className?: string }) {
  const c = CARRIL[carril];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-[1.4rem] py-[0.5rem] text-[1.9rem] font-semibold leading-none",
        c.clases,
        className
      )}
    >
      {etiqueta ?? c.label}
    </span>
  );
}
