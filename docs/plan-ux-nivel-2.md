# Plan: llevar SICS al siguiente nivel (estética + funcionalidad + rapidez) con las skills instaladas

## Contexto
Lisandro propuso este orden: `emil-design-eng` → `mobile-native` → `ask-sonner` → `redesign-existing-projects` → `improve-animations` → `break-ui`. Pidió una revisión y cómo lo haría yo. Respuestas del usuario: estilo **limpio y operativo, tipo Linear**; uso **mixto con el celular muy importante** (jefes y operativos cargan SIC en planta). Las fases 1 a 5 de la mejora UX previa (Sonner, CSS nativo, componentes `components/ui/*`, estados vacíos/carga, modo oscuro) ya están hechas; esto es la siguiente vuelta. Se mantienen las decisiones previas: CSS nativo sin Motion/GSAP, Tailwind 3, parche de modo oscuro, sin librerías nuevas sin consultar. EPCC: modo plan, `/confirmar`, commit solo con su ok, push suyo.

## Estado real del repo (auditoría de solo lectura)
- **Móvil sin cimientos**: `app/layout.tsx` no exporta `viewport` ni `theme-color`; no hay safe-area, `dvh` ni ajustes táctiles; 5 usos de `h-screen`/`min-h-screen`. La barra lateral se apila arriba del contenido por debajo de `lg` (sin menú tipo drawer, `AppShell.tsx:70-72`). ~139 inputs en `text-sm` (14 px) → iOS hace zoom al enfocar; la clase del input está copiada en cada archivo.
- **Tablas**: 4 `<table>` sin `overflow-x-auto` (`UsersTable`, `StaffUsersManager`, `ProjectsManager`, `PlantsManager`); grillas que no colapsan (`ItemsEditor`, `ProviderRow`). `Modal` sin variante bottom-sheet ni scroll interno; `FilePreview` y `ModuleSections` arman su propio overlay.
- **Sistema de diseño esquivado**: `Button` solo se importa en 2 archivos, `Card` y `Badge` en ninguno; 93 `<button>` crudos; `StatusBadge` duplica `Badge`; radios mezclados (lg 201, md 32, 2xl 29, xl 20); 22 textos de 10-11 px; 73 colores hex fuera del parche oscuro.
- **Movimiento**: 6 `transition-all`, 0 hovers protegidos con `@media (hover: hover)` (109 `hover:`), escala de presión duplicada (`globals.css:12` + `Button.tsx:41`), animación de grid-rows con `ease-in-out` (`ContractsList.tsx:252`, `ContractDetail.tsx:185`). Lo bueno: curvas custom, sin `scale(0)`, `prefers-reduced-motion` global, nada >360 ms.
- **Feedback**: Sonner bien integrado (44 llamadas); quedan 3 `prompt()` nativos en `ContractDetail.tsx:1028-1040` y mucho texto de error en línea. Sin `loading.tsx` ni `not-found.tsx`. Fuente: Inter (`next/font`, autoalojada: rápida). Sin `tabular-nums` en cifras.
- Pantallas más pesadas: `ContractDetail` (1730 líneas), `SicActions` (1236), `ContractsList` (468). Más usadas: dashboard, SIC (detalle y nueva), usuarios.

## Veredicto sobre tu orden
Es viable y la intuición es buena, con **cuatro ajustes**:
1. **`emil-design-eng` y `ask-sonner` no son pasos**: se activan solas y rigen todo el trabajo (curvas, duraciones, botones). `ask-sonner` se usa puntualmente (posición/offset de toasts en celular).
2. **`mobile-native` va primero y es estructural**: cambia el layout (nav, tablas, modal, inputs), así que si va después, el rediseño y las pruebas se rehacen.
3. **Falta un paso clave: unificar el sistema de diseño** (adoptar `Button/Card/Badge` + clase única de input). Con 93 botones sueltos, "rediseñar" es tocar 93 lugares; con el sistema unificado se cambia en un solo sitio. También es lo que hace al modo oscuro menos frágil.
4. **`redesign-existing-projects` va al medio, no "por casi finalizar", y filtrada**: es una skill pensada para sitios de marketing (fondos con fotos, asimetría, reemplazar la sidebar, cambiar íconos y fuentes). Para una herramienta operativa se usa solo su subconjunto útil: tipografía (`tabular-nums`, pesos 500/600, `text-wrap: balance`), sombras tintadas, jerarquía y estados, radios coherentes, indicadores de página activa. Se **descarta** lo decorativo, el cambio de fuente/íconos y la reubicación del menú. Hacerlo al final obligaría a rehacer el movimiento y las pruebas.
`improve-animations` (después del rediseño, sobre el movimiento final) y `break-ui` (cierre, a 320/390 px y en oscuro) quedan como los planteaste, con `break-ui` también probado por pantalla durante las fases.

## Fases (cada una = un chat de SICS con EPCC, prueba en Chrome claro/oscuro/390 px, `/confirmar`, un commit con su ok)
**Fase 0 – Línea base** (rápida): capturas de dashboard, SIC detalle, nueva SIC, usuarios y login en escritorio y 390 px, claro y oscuro; conteo `npx tsc --noEmit | grep -c "error TS"` (base ~83). Sirve para comparar al final.

**Fase 1 – Cimientos móviles** (`mobile-native` + `emil-design-eng`, `ask-sonner` para toasts)
- `viewport` exportado (`viewportFit: cover`, `themeColor` claro/oscuro); `100dvh` en login/shell/error/pendiente; safe-area en header/sidebar/toasts; `-webkit-tap-highlight-color`, `touch-action: manipulation`, `overscroll-behavior`.
- Inputs a 16 px en móvil con una **clase compartida** (nuevo `components/ui/Field` o `inputClass` único en `lib/`), reemplazando las copias.
- `AppShell`: menú lateral tipo drawer en móvil (CSS nativo, sin librerías) con barra superior; `Modal` con bottom-sheet en móvil y scroll interno; unificar `FilePreview`/`ModuleSections` sobre `Modal`.
- Tablas: `overflow-x-auto` con primera columna fija o vista en tarjetas en móvil; grillas colapsables (`grid-cols-1 sm:grid-cols-3`).
- Hovers dentro de `@media (hover: hover) and (pointer: fine)`; presión única (quitar el duplicado).
- Toasts: posición superior centrada en móvil, con offset de safe-area (`ask-sonner`).

**Fase 2 – Sistema de diseño unificado** (`emil-design-eng`)
- Adoptar `Button/Card/Badge/Field` en las pantallas más usadas primero (dashboard, `SicsList`, `SicActions`, `NuevaSicForm`, usuarios); `StatusBadge` → `Badge`.
- Escala de radios (contenedor `xl`, control `lg`, interno `md`), tamaño de texto mínimo 12 px, íconos inline → `components/icons.tsx`.
- Los 3 `prompt()` → `Modal` con formulario; errores en línea → toast cuando corresponda.
- Los 73 hex → tokens/clases cubiertas por el parche oscuro; correr `node scripts/generar-modo-oscuro.js`.
- Dejar `ContractDetail`/`ContractsList` para el final (los más grandes y de menor uso diario).

**Fase 3 – Estética "Linear" operativa** (`/redesign-existing-projects`, aplicada con filtro explícito)
- `tabular-nums` en montos/cantidades/numeración SIC; jerarquía tipográfica (títulos 600, etiquetas 500, `text-wrap: balance`); sombras y bordes tintados con el tono existente; espaciado y densidad consistentes; indicador de página activa; Inter se mantiene (rápida y ya autoalojada).
- Estados: `loading.tsx` con skeletons por ruta principal, `not-found.tsx`, estados vacíos con acción.
- **No** se aplican: fotos de fondo, asimetría decorativa, cambio de fuente/íconos/menú, texturas.

**Fase 4 – Movimiento** (`/improve-animations` → plan en `plans/` → ejecutar lo aprobado → `/review-animations` como compuerta)
- Corregir `transition-all` (6), grid-rows con `ease-in-out`, microinteracciones con escalonado corto de 30-80 ms solo en listas del dashboard, sin animar acciones de teclado, salida más rápida que entrada. Mantener `prefers-reduced-motion`.

**Fase 5 – Resistencia** (`/break-ui` por pantalla y al cierre)
- Fixtures de peor caso (nombres largos, correos largos, 0 y 1.000 ítems, montos grandes, emoji, 320/390 px, 200 % de zoom, oscuro) sobre `SicsList`, `SicActions`, `UsersTable`, `NuevaSicForm`, `ItemsEditor`, `ContractsList`. Toggle solo de desarrollo, nunca a producción ni datos reales. Informe primero; arreglos solo los aprobados.

**Fase 6 – Cierre y rapidez**
- `/confirmar` con `revisor-sics`; `npx tsc --noEmit` sin errores nuevos; revisar tamaño de rutas en `npm run build` (la dependencia `xlsx` es pesada: confirmar que solo carga al exportar, si no, importación dinámica); Lighthouse en Chrome (móvil) antes/después contra la línea base de la Fase 0.

## Riesgos y reglas
- Dev server con **producción** de Supabase: las pruebas visuales son de lectura o con registros reversibles; `break-ui` usa fixtures locales.
- Cambios amplios de UI = diffs grandes: un commit por fase, nunca mezclar con cambios de negocio ni migraciones.
- Si el parche oscuro no cubre un caso nuevo, se regenera y se revisa en Chrome en ambos temas.
- Las skills asesoran, no deciden: sin librerías nuevas, sin Tailwind 4, sin cambio de fuente/íconos sin consultar.
- Fuera de alcance: lógica de negocio, RPC, flujograma (no cambia el circuito).

## Verificación (cada fase)
1. `npx tsc --noEmit` sin errores nuevos vs la base (~83); `npm run build` compila.
2. Chrome (`probar-en-chrome`) en `localhost:3000`: sin errores de consola; capturas claro/oscuro en escritorio y 390 px comparadas con la línea base.
3. En móvil: sin zoom al enfocar inputs, sin scroll horizontal de página, menú y modales usables a una mano, toasts visibles sobre la barra segura.
4. `git diff package.json` vacío (sin dependencias nuevas).
5. Devolución con `/confirmar`; commit con su ok; recordar push.
