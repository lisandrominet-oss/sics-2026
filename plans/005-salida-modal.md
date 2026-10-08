# 005 — Salida animada del Modal

- **Status**: TODO
- **Commit**: 7b9c50e
- **Severity**: MEDIUM
- **Category**: Física y origen / Asimetría entrada-salida
- **Estimated scope**: 3 archivos (`Modal.tsx`, `ConfirmProvider.tsx`, `tailwind.config.ts`)

## Problem
```tsx
// components/ui/Modal.tsx:80-82
if (!open || typeof document === "undefined") return null;
return createPortal(<div ... className="fixed inset-0 z-50 flex animate-fade-in ..."> ... <div role="dialog" className={... "animate-slide-up ... sm:animate-scale-in ..."}>
```
Al cerrar el modal desaparece de golpe; en el celular el bottom-sheet no baja. `components/ui/ConfirmProvider.tsx:47` renderiza `options?.title ?? ""` y `options?.description`: al cerrar (`setOptions(null)`) el contenido quedaría vacío durante cualquier salida.

## Target
Keyframes nuevos (`tailwind.config.ts`, constantes del plan 001):
```ts
"fade-out":  { from: { opacity: "1" }, to: { opacity: "0" } },
"scale-out": { from: { opacity: "1", transform: "scale(1)" }, to: { opacity: "0", transform: "scale(0.97)" } },
"sheet-out": { from: { transform: "translateY(0)" }, to: { transform: "translateY(100%)" } },
// animation (todas ease-out, siempre más cortas que la entrada: 220/280 ms):
"fade-out":  "fade-out 140ms ease-out both",
"scale-out": "scale-out 140ms ease-out both",
"sheet-out": `sheet-out 180ms ${OUT_EXPO} both`,
```
`Modal.tsx`:
- Estado `render` (arranca en `open`): `const visible = open || render`; efecto que pone `render = true` al abrir; al cerrar (`!open && render`) el overlay usa `animate-fade-out pointer-events-none`, el panel `animate-scale-out` (dialog/bare en escritorio) o `animate-sheet-out` (sheet móvil: `max-sm:`/clases responsivas equivalentes a las de entrada), y el panel hace `render = false` en `onAnimationEnd` (filtrando `e.target === e.currentTarget`) más un `setTimeout` de seguridad de 220 ms.
- El foco vuelve al disparador y se restaura el scroll del body como hoy (el efecto depende de `open`, no de `visible`). Escape y el listener de teclado solo mientras `open`.
`ConfirmProvider.tsx`: guardar las últimas opciones en un ref (`const last = useRef(options); if (options) last.current = options;`) y renderizar el contenido con `options ?? last.current` mientras `Modal` está saliendo.

## Repo conventions to follow
`Modal` lo usan `FilePreview` (variant `bare`), `ModuleSections`, `PromptDialog` (su estado interno persiste mientras está montado) y `ConfirmProvider`. El contenedor `bare` ya usa `animate-scale-in`; su salida es `scale-out`.

## Steps
1. Agregar los keyframes/animaciones de salida a `tailwind.config.ts`.
2. `Modal.tsx`: estado de montaje, clases de salida, `onAnimationEnd` con timeout de seguridad.
3. `ConfirmProvider.tsx`: contenido de salida con ref.

## Boundaries
No cambiar props públicas de `Modal` ni el atrapado de foco/Escape. No tocar el visor `bare` más allá de la salida. Sin dependencias.

## Verification
- **Mecánica**: `tsc` = 83.
- **Feel check** (390 px y 1280 px): abrir y cerrar `ConfirmProvider` (botón de eliminar de una pantalla con datos de prueba, **sin confirmar**) y el visor de archivos: el sheet baja 180 ms, el diálogo se achica y se desvanece 140 ms, sin panel vacío; Escape cierra con salida; abrir de nuevo durante la salida no deja un modal huérfano; doble toque rápido en "Cancelar" no dispara dos veces; el foco vuelve al botón que lo abrió; con `prefers-reduced-motion` cierra al instante sin quedar colgado.
- **Done when**: ningún modal desaparece sin animación y el DOM no conserva el overlay tras cerrar.
