import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

// Marco de carga de las pantallas con menú: imita la barra superior (celular) y el menú lateral (escritorio)
// para que, al navegar, el menú no desaparezca y reaparezca. Cada `loading.tsx` pone adentro el esqueleto de su pantalla.
export default function LoadingFrame({ children, width = "max-w-6xl" }: { children: ReactNode; width?: string }) {
  return (
    <div role="status" aria-busy="true" className="min-h-dvh bg-slate-50 lg:flex">
      <div
        aria-hidden="true"
        className="sticky top-0 flex h-[calc(60px+env(safe-area-inset-top))] items-center justify-center bg-slate-900 pt-[env(safe-area-inset-top)] lg:hidden dark:border-b dark:border-white/10"
      >
        <img src="/brand/logo-completo-negativo.svg" alt="" className="h-9 w-auto" />
      </div>
      <div
        aria-hidden="true"
        className="hidden w-64 shrink-0 bg-slate-900 px-4 py-6 lg:sticky lg:top-0 lg:block lg:h-dvh dark:border-r dark:border-white/10"
      >
        <div className="mx-2 h-12 w-40 rounded-md bg-white/10" />
        <div className="mt-10 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mx-3 h-4 rounded bg-white/5" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <main className="pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-10">
          <div className={cn("mx-auto", width)}>{children}</div>
        </main>
      </div>
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
