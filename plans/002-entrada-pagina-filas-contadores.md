# 002 — Entrada de página, escalonado de filas y contadores

- **Status**: TODO
- **Commit**: 7b9c50e
- **Severity**: HIGH
- **Category**: Propósito y frecuencia / Easing y duración
- **Estimated scope**: 5 archivos

## Problem
Cada navegación corre una animación pesada y se apila con las de los hijos:
```tsx
// components/AppShell.tsx:253
<div className="animate-enter">{children}</div>
// app/dashboard/page.tsx:179
<Card padding="lg" style={{ animationDelay: `${delay}ms` }} className="animate-enter">
// components/SicsList.tsx:115-116
style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
className="group relative flex animate-enter flex-wrap ... transition-colors hover:bg-slate-50"
```
`animate-enter` = `fade-up 360ms` (sube 8 px). Resultado: hasta ~720 ms hasta quedar quieto y opacidades que se multiplican. Y al venir de un `loading.tsx` aparece 1 cuadro en blanco. Además `components/ui/AnimatedNumber.tsx` cuenta de 0 en 700 ms en cada visita (arranca mostrando el valor final, salta a 0 y sube) y el ícono del menú crece al pasar el mouse (`AppShell.tsx:52`):
```tsx
<span className="transition-transform duration-base ease-out-expo group-hover:scale-110">{icon}</span>
```

## Target
Keyframes nuevos en `tailwind.config.ts` (`keyframes` + `animation`):
```ts
"page-in": { from: { opacity: "0" }, to: { opacity: "1" } },
"row-in":  { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
// animation:
"page-in": `page-in 160ms ease-out backwards`,
"row-in": `row-in 200ms ${OUT_EXPO} backwards`,
```
- `AppShell.tsx:253`: `<div className="animate-page-in">{children}</div>`.
- `dashboard/page.tsx` StatCard: quitar `animate-enter`, `style` y la prop `delay` (y los `delay={…}` de las 3 llamadas); no son una lista.
- `SicsList.tsx`: `animate-row-in` en lugar de `animate-enter` y `Math.min(index, 6) * 30` (máximo 180 ms de demora + 200 ms = 380 ms).
- `AppShell.tsx:52`: `<span>{icon}</span>` (sin transición ni escala).
- `AnimatedNumber`: `duration` por defecto 300; el primer montaje muestra el valor sin animar (`first` → `setShown(value)` y salir); solo anima cuando `value` cambia, desde el valor anterior.

## Repo conventions to follow
- Las animaciones se declaran en `tailwind.config.ts` con las curvas de las constantes del plan 001 y se usan como `animate-*`. `login/page.tsx` y `EmptyState` conservan `animate-enter`/`animate-fade-up` (pantallas poco frecuentes).
- `prefers-reduced-motion` en `globals.css` ya anula las animaciones: no tocar.

## Steps
1. Agregar `page-in` y `row-in` a la config (depende del plan 001 por las constantes).
2. Aplicar los cambios de `AppShell.tsx`, `dashboard/page.tsx`, `SicsList.tsx`, `AnimatedNumber.tsx`.

## Boundaries
- No tocar `login`, `EmptyState`, `loading.tsx` ni la lógica de datos.
- No cambiar el contenido ni los valores que muestra `AnimatedNumber`.
- Si el código no coincide con las citas, frenar e informar.

## Verification
- **Mecánica**: `tsc` = 83.
- **Feel check**: navegar Tablero ↔ SIC ↔ Contratos: el contenido hace un fade corto, sin subir ni dejar un cuadro en blanco visible; las primeras 6 filas del Tablero entran escalonadas y a las 7.ª en adelante aparecen con la 6.ª; los números del Tablero aparecen ya con su valor, sin salto a 0; pasar el mouse por el menú no mueve los íconos. `document.getAnimations()` en la navegación: ninguna dura más de 360 ms (incluida la demora).
- **Done when**: no queda `animate-enter` en `AppShell`, `SicsList` ni `StatCard`.
