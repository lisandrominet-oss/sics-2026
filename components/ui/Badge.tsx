import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  brand: "bg-indigo-100 text-indigo-700",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  brand: "bg-indigo-500",
};

export default function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Punto de color previo al texto: el estado no depende solo del color de fondo. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-base",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
