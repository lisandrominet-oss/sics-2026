import { cn } from "@/lib/cn";

// Barra de avance: tinta sobre fondo neutro (el color queda para estados, no para decorar).
export default function CalidadProgress({ pct, className, label }: { pct: number | null; className?: string; label?: string }) {
  const value = pct ?? 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label ?? "Avance"}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200", className)}
    >
      <div className="h-full rounded-full bg-ink transition-[width] duration-base ease-out-expo" style={{ width: `${value}%` }} />
    </div>
  );
}
