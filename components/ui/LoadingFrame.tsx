import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

// Marco de carga de las pantallas con menú: el menú real ya está en pantalla (lo pone `app/(app)/layout.tsx`),
// así que acá solo va el contenedor con el ancho de la página. Cada `loading.tsx` pone adentro el esqueleto de su pantalla.
export default function LoadingFrame({ children, width = "max-w-6xl" }: { children: ReactNode; width?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("mx-auto", width)}>
      {children}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Título + línea de descripción, y un botón opcional a la derecha. */
export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-10 w-32 rounded-lg" />}
    </div>
  );
}

/** Fila de tarjetas de totales. */
export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Tarjeta con una grilla de datos (etiqueta + valor). */
export function InfoCardSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-36 max-w-full" />
        </div>
      ))}
    </div>
  );
}
