import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "muted" | "critical" | "violet" | "sky";

const TONES: Record<BadgeTone, string> = {
  // En B solo hay cuatro tonos con color propio (ok, aviso, error, neutro). Info, marca y las etiquetas de tipo van en neutro.
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  brand: "bg-slate-200 text-slate-900",
  /** Estados terminales o inactivos (cerrada, devuelto). */
  muted: "bg-slate-100 text-slate-500",
  /** Estados negativos definitivos (anulada). */
  critical: "bg-red-200 text-red-900",
  /** Etiqueta de tipo (cuenta corriente). */
  violet: "bg-slate-100 text-slate-700",
  /** Etiqueta de tipo (compra directa). */
  sky: "bg-slate-100 text-slate-700",
};

export default function Badge({
  tone = "neutral",
  dot = false,
  size = "md",
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Punto previo al texto: el estado no depende solo del color de fondo. */
  dot?: boolean;
  /** `sm` para etiquetas dentro de una línea de texto. */
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-medium transition-colors duration-base",
        size === "sm" ? "px-2 py-0.5" : "px-2.5 py-0.5",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {children}
    </span>
  );
}
