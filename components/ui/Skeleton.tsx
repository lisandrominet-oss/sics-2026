import { cn } from "@/lib/cn";

// Bloque de carga con brillo que recorre la superficie.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden rounded-md bg-slate-200", className)}
    >
      <div className="shimmer-bg absolute inset-0 animate-shimmer" />
    </div>
  );
}

// Lista de filas de carga (por ejemplo, mientras llegan las solicitudes).
export function SkeletonRows({ rows = 5, silent = false }: { rows?: number; silent?: boolean }) {
  return (
    <div {...(silent ? { "aria-hidden": true } : { role: "status", "aria-label": "Cargando" })} className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
      {!silent && <span className="sr-only">Cargando…</span>}
    </div>
  );
}
