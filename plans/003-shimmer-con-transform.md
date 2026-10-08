# 003 — Brillo de los esqueletos solo con `transform`

- **Status**: DONE
- **Commit**: 7b9c50e
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 3 archivos

## Problem
El brillo anima `background-position` en cada bloque (repinta en cada cuadro, justo mientras el hilo principal hidrata la página):
```tsx
// components/ui/Skeleton.tsx:5-12
<div aria-hidden="true" className={cn("relative overflow-hidden rounded-md bg-slate-200", className)}>
  <div className="shimmer-bg absolute inset-0 animate-shimmer" />
</div>
```
```css
/* app/globals.css:155-166 */
.shimmer-bg { background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%); background-size: 200% 100%; }
```
```ts
// tailwind.config.ts
shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
shimmer: "shimmer 1.6s linear infinite",
```
Además `SkeletonRows` (`Skeleton.tsx:23`) pone `style={{ animationDelay: ... }}` en un contenedor sin animación: no hace nada.

## Target
```ts
shimmer: { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(100%)" } },
shimmer: "shimmer 1.6s linear infinite",   // constante: es movimiento continuo, linear es correcto
```
```css
.shimmer-bg { background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%); }
```
(se borra `background-size`; el modo oscuro `.dark .shimmer-bg` queda igual). El padre ya tiene `overflow-hidden`, así que el brillo recorre el bloque sin salirse. En `SkeletonRows`, borrar el `style={{ animationDelay }}` muerto.

## Repo conventions to follow
`Skeleton.tsx` es el único lugar donde se usa `shimmer-bg`; los `loading.tsx` y `LoadingFrame` lo consumen a través de `Skeleton`.

## Steps
1. `tailwind.config.ts`: keyframe `shimmer` por `translateX`.
2. `app/globals.css`: sacar `background-size`.
3. `components/ui/Skeleton.tsx`: borrar el `animationDelay` de `SkeletonRows`.

## Boundaries
No tocar `LoadingFrame.tsx` ni los `loading.tsx`. Sin cambios de color ni de tamaño de bloques.

## Verification
- **Mecánica**: `tsc` = 83.
- **Feel check**: forzar un esqueleto (página temporal o `loading.tsx` con red lenta): el brillo pasa de izquierda a derecha y se reinicia sin saltos, en claro y oscuro; en el panel Performance no hay repintados por cuadro de los bloques; con `prefers-reduced-motion` queda quieto.
- **Done when**: ninguna animación del proyecto usa `backgroundPosition`.
