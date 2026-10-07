import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "muted" | "critical" | "violet" | "sky";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  brand: "bg-indigo-100 text-indigo-700",
  /** Estados terminales o inactivos (cerrada, devuelto). */
  muted: "bg-slate-200 text-slate-600",
  /** Estados negativos definitivos (anulada). */
  critical: "bg-red-200 text-red-800",
  /** Etiqueta de tipo (cuenta corriente). */
  violet: "bg-violet-100 text-violet-700",
  /** Etiqueta de tipo (compra directa). */
  sky: "bg-sky-100 text-sky-700",
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold uppercase transition-colors duration-base",
        size === "sm" ? "px-2 py-0.5" : "px-3 py-1 tracking-wide",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {children}
    </span>
  );
}
