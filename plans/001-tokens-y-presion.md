# 001 — Tokens de movimiento y presión única

- **Status**: DONE
- **Commit**: 7b9c50e
- **Severity**: HIGH
- **Category**: Cohesión y tokens / Performance / Physicality
- **Estimated scope**: 6 archivos, pocas líneas cada uno

## Problem
1. La presión al tocar tiene tres mecanismos y ninguno transiciona bien:
```css
/* app/globals.css:75-86 — current */
@layer base {
  button:not(:disabled):active { transform: scale(0.98); }
  button, [role="button"] {
    transition-property: color, background-color, border-color, box-shadow, opacity, transform;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```
`components/ui/Button.tsx:45` usa `transition-colors duration-base`; esa utilidad (capa utilities) pisa la regla base, así que `transform` nunca se transiciona y la escala entra y sale de golpe. Los `<Link>` estilados con `buttonClass` (Nueva SIC, Crear una SIC) no tienen presión. `app/dashboard/page.tsx:203` (FilterTab) tiene su propia `active:scale-95` con `transition-all`.
2. Tres `transition-all` (animan propiedades que no deben):
```tsx
// app/dashboard/page.tsx:203
className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all duration-base active:scale-95 ${
// components/AppShell.tsx:46
className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-base ${
// components/ui/Card.tsx:43-44
interactive &&
  "cursor-pointer transition-all duration-base ease-out-expo hover:-translate-y-0.5 hover:shadow-lift",
```
3. Los `cubic-bezier` están escritos a mano en 6 `animation` de `tailwind.config.ts` aparte de los tokens `out-expo` y `spring`.

## Target
`tailwind.config.ts`:
```ts
const OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
// transitionTimingFunction: { "out-expo": OUT_EXPO, drawer: DRAWER, spring: SPRING }
// transitionDuration: { fast: "120ms", base: "200ms", open: "240ms", close: "160ms", slow: "320ms" }
// transitionProperty: { colors: "color, background-color, border-color, text-decoration-color, fill, stroke, scale" }
// animation: reemplazar los literales de cubic-bezier por ${OUT_EXPO} / ${SPRING} (mismos valores).
```
`app/globals.css` (reemplaza el bloque de arriba; la regla va en `@layer base`):
```css
@layer base {
  button:not(:disabled):active,
  .press:not(:disabled):active {
    scale: 0.97;
  }
  button,
  [role="button"],
  .press {
    transition-property: color, background-color, border-color, box-shadow, opacity, scale;
    transition-duration: 120ms;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }
}
```
- `buttonClass` (`Button.tsx`): agregar la clase `press` a la cadena base y pasar a `duration-fast ease-out-expo` (120 ms: entra al presupuesto de presión de 100-160 ms): `"press inline-flex items-center justify-center gap-2 font-medium transition-colors duration-fast ease-out-expo"`.
- FilterTab: `transition-colors duration-base ease-out-expo press`, sin `active:scale-95`.
- NavLink: `transition-colors duration-base` (el ícono sin escala: ver plan 002).
- Card interactive: `"cursor-pointer transition-colors duration-base hover:border-slate-300 hover:bg-slate-50"` (sin elevación ni sombra).

## Repo conventions to follow
- Los tokens viven en `tailwind.config.ts` (`theme.extend`); las clases se usan como `duration-base`, `ease-out-expo`.
- Parche oscuro: `hover:border-slate-300 hover:bg-slate-50` son clases que el generador reconoce; correr `node scripts/generar-modo-oscuro.js` y revisar el diff de `app/dark-theme.css`.

## Steps
1. `tailwind.config.ts`: constantes, `drawer`, duraciones `open`/`close`, `transitionProperty.colors` con `scale`, y literales de las `animation` por las constantes (mismo valor, mismo resultado).
2. `app/globals.css`: reemplazar el bloque de presión por el de arriba.
3. `components/ui/Button.tsx`: clase `press` en `buttonClass`.
4. `app/dashboard/page.tsx:203`: FilterTab.
5. `components/AppShell.tsx:46`: NavLink.
6. `components/ui/Card.tsx:44`: interactive.
7. Reiniciar el dev server (cambió `tailwind.config.ts`).

## Boundaries
- No tocar la lógica de los componentes, solo clases de movimiento.
- No agregar dependencias. No cambiar `prefers-reduced-motion`.
- Si el código no coincide con las citas (deriva desde `7b9c50e`), frenar e informar.

## Verification
- **Mecánica**: `npx tsc --noEmit | grep -c "error TS"` = 83; `grep -rn "transition-all" app components` sin resultados.
- **Feel check**: en Chrome, `getComputedStyle(botón).transitionProperty` incluye `scale`; presionar un `Button`, el `<Link>` "Nueva SIC" y un FilterTab: los tres se hunden 3 % y vuelven con suavidad (con `playbackRate = 0.1` se ve la curva); con `prefers-reduced-motion` no hay movimiento.
- **Done when**: sin `transition-all`, una sola regla de presión, todos los botones y botón-links la comparten.
