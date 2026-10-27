import { cn } from "@/lib/cn";

export type Carril = "emisor" | "jefe" | "compras" | "gerencia" | "panol" | "admin";

// Un tono por carril del circuito, solo con la paleta de B: neutros, tinta y los dos tonos con color propio (ok y aviso).
export const CARRIL: Record<Carril, { label: string; clases: string }> = {
  emisor: { label: "Emisor", clases: "bg-slate-100 text-slate-700" },
  jefe: { label: "Jefe de área", clases: "bg-slate-200 text-slate-900" },
  compras: { label: "Compras", clases: "bg-emerald-100 text-emerald-800" },
  gerencia: { label: "Gerencia", clases: "bg-amber-100 text-amber-900" },
  panol: { label: "Pañol", clases: "bg-sheet text-slate-700 ring-1 ring-inset ring-slate-300" },
  admin: { label: "Administrador", clases: "bg-ink text-on-ink" },
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
