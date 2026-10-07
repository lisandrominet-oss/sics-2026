# Plan Fase 2 — Sistema de diseño unificado (SICS)

> Detalle de la Fase 2 de `docs/plan-ux-nivel-2.md`. Aprobado por Lisandro el 2026-10-07. Se ejecuta en un chat nuevo (un chat por fase).

## Estado al corte (2026-10-07)
Fases 0 y 1 y el acordeón de Contratos están hechos y en `origin/main`. **Commit A hecho y verificado, pendiente del ok de Lisandro para commitear** (`tsc` = 83, build compila, Chrome en 1280/390 px claro y oscuro, revisor-sics sin hallazgos importantes):
- `components/ui/Button.tsx`: variantes `warning`, `link`, `link-danger`; sin sombra; `transition-colors`; exporta `buttonClass()` para estilar `<Link>`.
- `components/ui/Badge.tsx`: `text-xs`, tonos `muted` y `critical`, punto con `bg-current`.
- `components/StatusBadge.tsx`: envuelve `Badge`; `STATUS_TONES` vive **dentro de este archivo** (no en `lib/constants.ts`); se borró `STATUS_COLORS`.
- `components/ui/Card.tsx` (`rounded-xl`, `padding`, `elevated`, `interactive`, `title`) e `InfoItem.tsx` (reemplaza `Info`/`Field` locales de SIC, ContractDetail, ProfilePreferences y ProviderRow).
- `lib/ui.ts`: `inputCompactClass`, `labelClass`. Tokens `sidebar-*` en `tailwind.config.ts`. Íconos en línea a `components/icons.tsx`. `rounded-2xl`→`xl` (salvo Modal) y textos de 10-11 px→`text-xs` (salvo el contador de la campana).
Para B y C (avisos del revisor): `Card` ya no lleva `shadow-soft` por defecto (usar `elevated` donde había sombra); `Button warning` es blanco sobre ámbar-600 (contraste ~3,2:1, mirarlo en "Exportar" de `SicsList`); el `Card` local de `ContractDetail` y las píldoras de estado sueltas (`ContractDetail`, `ContractsList`, SIC, `SicsList`, `ProviderRow`) siguen sin migrar; `shadow-[inset_3px_0_0_0_#818cf8]` en `AppShell.tsx:48` queda como hex (sombra del ítem activo); `ProviderRow` tiene un `<button>` dentro de otro `<button>` (error de hidratación previo): corregir en B; badge largo en `SicsList` a 390 px sin ver con datos reales.

## Cosas aprendidas (evitan perder tiempo)
- **Reiniciar el dev server** cuando cambia `tailwind.config.ts` (`preview_stop` + `preview_start`); si no, las utilidades nuevas no se generan.
- **Prueba a 390 px**: Chrome no deja achicar la ventana; se usa un iframe de 390 px en una página del mismo origen (`document.write` con `<iframe src="/ruta">`). Para cambiar el tema: `localStorage.setItem('sc_theme','dark'|'light')`. Ojo: cambiar el tema desde la página padre dispara el evento `storage` en el iframe.
- **Sesión local**: el login con Google lo hace Lisandro; la sesión de `localhost:3000` expira a los 30 min de inactividad. `localhost:3000` ya está en las redirecciones de Supabase.
- **"Ver como: Compras"**: Lisandro está viendo como Compras y hay 0 SIC; no se pueden abrir detalle de SIC ni Usuarios/Plantas/Proyectos. Cambiar "Ver como" escribe en su perfil real: no tocar sin su ok. Para esas pantallas, página temporal con datos falsos (borrarla antes del commit y limpiar `.next/types/app/<pagina>`, que si no suma 2 errores a `tsc`).
- **Parche oscuro**: solo reconoce clases tipo `bg|text|border|divide-<color>-<NNN>` (y `white|black`); las variantes `hover:`, `disabled:`, `focus:` se envuelven en `@media (hover: hover)` en el generador. Los nombres propios sin escala numérica (`sidebar-muted`) quedan fuera.
- **`tsc`** debe mantenerse en 83; comparar el conjunto de errores si el conteo cambia.
- **Revisor**: usar el subagente `revisor-sics` antes de pedir el ok de commit; commit solo con el "ok" de Lisandro; nunca `git push`.

## Contexto
Fases 0 y 1 (+ acordeón de Contratos) ya están hechas y en `origin/main`. La Fase 2 del `docs/plan-ux-nivel-2.md` es llevar las pantallas a **un solo set de componentes** (`Button`, `Card`, `Badge`, `Field`) para que la estética tipo Linear (Fase 3) y el movimiento (Fase 4) se cambien en un solo lugar. Hoy el sistema se esquiva: `Button` solo lo usan 2 archivos (`app/error.tsx`, `ConfirmProvider`), `Card` y `Badge` ninguno; hay ~95 `<button>` crudos en 28 archivos, `StatusBadge` duplica `Badge`, 4 componentes locales duplicados (`Info` ×2, `Field` ×2, `Card` local en `ContractDetail`, `StatCard`), 22 textos de 10-11 px, 14 colores hex en el menú, 3 `prompt()` nativos en `ContractDetail.tsx:1029-1041` y ~18 archivos con error rojo en línea.

Reglas que se mantienen: sin librerías nuevas, Tailwind 3, sin tocar lógica de negocio/RPC/flujograma, `tsc` ≤ 83, dev server con Supabase de producción (solo lectura), commit solo con tu ok, push tuyo.

## Decisiones (ya acordadas con Lisandro)
- **3 commits**: A base del sistema, B pantallas, C Contratos + `prompt()`.
- **Errores**: pasan a `notify.error` solo los de **acciones** (guardar, aprobar, exportar, botones de fila). Los de **validación de formulario** (SIC nueva, contrato, login) quedan junto al campo.
- **`Button` plano** (como los botones de hoy): sin sombra. La sombra/bordes van en la Fase 3.
- Escala de radios del plan: contenedor `xl`, control `lg`, interno `md`, pastilla `full`; los **overlays** (Modal/bottom-sheet) mantienen `2xl`.

## Commit A — Base del sistema (casi sin cambio visual)
1. **`components/ui/Button.tsx`**: variantes `primary, secondary, danger, ghost` + nuevas `warning` (ámbar, exportar en `SicsList`), `link` (texto índigo) y `link-danger` (texto rojo, "Quitar"/"Eliminar"); sin `shadow`; `transition-colors` en vez de `transition-all` (pendiente de Fase 4). Exportar `buttonClass({variant,size})` para estilar `<Link>` como botón (dashboard "Nueva SIC", "Crear una SIC"). La presión (`scale .98`) sigue en `globals.css`.
2. **`components/ui/Badge.tsx`**: `text-xs` (12 px); tonos nuevos `muted` (slate-200/600 = `cerrada`) y `critical` (red-200/800 = `anulada`) para conservar los colores actuales. **`StatusBadge`** pasa a envolver `Badge` con `STATUS_TONES` (dentro de `StatusBadge.tsx`; reemplaza `STATUS_COLORS` de `lib/constants.ts`, que solo usaba `StatusBadge`).
3. **`components/ui/Card.tsx`**: `rounded-xl`, props `padding` (`none|md|lg`, evita pelear clases `p-5`/`p-6`), `elevated` (opt-in a `shadow-soft`), `title?` (cubre el `Card` local de `ContractDetail`), `interactive`.
4. **`components/ui/InfoItem.tsx`** (nuevo): etiqueta + valor de solo lectura; reemplaza los 4 locales (`Info` en `app/sic/[id]/page.tsx` y `ContractDetail`, `Field` en `ProfilePreferences` y `ProviderRow`). `Field` de `components/ui/Field.tsx` (etiqueta + campo) queda para formularios.
5. **`lib/ui.ts`**: sumar `inputCompactClass` (`rounded-md px-2 py-1`, selects de tabla) y `labelClass`; la regla de 16 px móvil de `globals.css` ya cubre ambos.
6. **Tokens del menú**: en `tailwind.config.ts` `colors.sidebar` (`fg #cbd5e1`, `muted #94a3b8`, `subtle #64748b`, `strong #f1f5f9`) y reemplazar los 14 `text-[#…]` de `AppShell`, `NotificationsBell`, `SignOutButton` por `text-sidebar-*`. Primero confirmar que `scripts/generar-modo-oscuro.js` ignora nombres sin escala numérica (el menú es siempre oscuro y no debe pasar por el parche). Los hex de `icons.tsx` (Google), `layout.tsx` y `lib/theme.ts` son legítimos y se quedan.
7. **Radios y tamaño mínimo**: `rounded-2xl` → `rounded-xl` en contenedores (28 usos; excepto `Modal`), `text-[10px]/[11px]` → `text-xs` (22 usos). Excepción documentada: el contador de la campana (`text-[10px]` en círculo de 16 px, ya tiene `aria-label`).
8. **Íconos en línea → `components/icons.tsx`**: `DashboardControls`, `NotificationsBell` (check), `EmptyState` (bandeja), `app/error.tsx`. `Spinner` queda.
9. Regenerar `app/dark-theme.css`; reiniciar dev server (cambia `tailwind.config.ts`).

## Commit B — Pantallas más usadas y de gestión
Patrón por archivo: `<button className="rounded-lg bg-indigo-600 …">` → `<Button size=…>` (variante según clase actual: indigo=primary, borde slate=secondary, rojo=danger, texto=link/link-danger, ámbar=warning); `disabled={busy}` + texto "Guardando…" → se conserva el texto y se agrega `loading={busy}`; contenedores `rounded-xl/2xl border-slate-200 bg-white p-*` → `Card`; badges → `Badge`/`StatusBadge`; selects/inputs restantes → `inputClass`/`inputCompactClass`.
- **Primero (más usadas)**: `app/dashboard/page.tsx` (+ `StatCard`→`Card`), `DashboardControls`, `SicsList`, `app/sic/[id]/page.tsx`, `SicActions` (12 botones; ojo el dinámico `colors` ~línea 1111), `NuevaSicForm`, `ItemsEditor`, `ExportSicButton`, `UsersTable`, `StaffUsersManager`.
- **Después**: `ProvidersManager`, `ProviderRow`, `ProvisioningManager`, `PlantsManager`, `ProjectsManager`, `ProfilePreferences`, `ConfigForm`, `ProviderCategoryPicker`, `app/login/page.tsx`, `app/pendiente`.
- **Errores**: en acciones/filas (`UsersTable`, `StaffUsersManager` filas, `SicActions`, `SicsList` exportar, `ProviderRow` acciones, `ProvisioningManager`, `PlantsManager`/`ProjectsManager` altas) se reemplaza `setError`+`<p role="alert">` por `notify.error(msg)`; validación de formulario (`NuevaSicForm`, `ContractForm`, `ConfigForm`, login) se deja en línea. Se elimina el estado `error` solo si queda sin uso.
- Sin cambios de lógica: mismos handlers, mismos RPC y parámetros; solo cambia el marcado y dónde se muestra el error.

## Commit C — Contratos y `prompt()`
- `ContractsList`, `ContractDetail`, `ContractForm`: mismo patrón (Button/Card/Badge/InfoItem); `CONTRACT_DISPLAY_STATUS_COLORS` y `CONTRACT_INSTALLMENT_STATUS_COLORS` (`lib/contracts.ts`) → tonos de `Badge`. `aria-controls` de las tarjetas de dinero (pendiente del revisor).
- **3 `prompt()` → `Modal` con formulario** (`ContractDetail.tsx:1029-1041`): componente `PromptDialog` reutilizable. *Anular factura*: motivo obligatorio → `void_provider_invoice` con los mismos `p_invoice_id`/`p_reason`. *Aceptar diferencia*: motivo obligatorio + monto opcional → `accept_installment_difference` con los mismos `p_installment_id`/`p_amount`/`p_note`. Cambio de comportamiento menor y declarado: hoy un monto no numérico viaja como `NaN`; en el modal se valida (número válido, coma decimal tolerada) y se muestra el error en el diálogo; vacío sigue siendo `null`.

## Verificación (por commit)
1. `npx tsc --noEmit | grep -c "error TS"` ≤ 83 (borrar `.next/types` huérfanos si cuenta de más); `npm run build` compila; `git diff package.json` vacío.
2. `node scripts/generar-modo-oscuro.js` y revisar el diff de `app/dark-theme.css`.
3. Chrome (`probar-en-chrome`, sesión de Lisandro; si expira por inactividad de 30 min, vuelve a entrar él) en `localhost:3000`, claro y oscuro, 1280 y 390 px (iframe): Tablero, Nueva SIC, Proveedores, Contratos, Preferencias; comparar con `docs/linea-base-ux.md` (debe verse igual salvo radios 2xl→xl y textos de 12 px). Consola limpia.
4. **No alcanzables con producción** (0 SIC, "Ver como: Compras"): detalle de SIC, Usuarios/Plantas/Proyectos y los diálogos de Contratos. Se verifican con una **página temporal de prueba con datos falsos** (se borra antes del commit; limpiar `.next/types/app/<página>`) sin llamar a ningún RPC. Se declara lo que no se pudo ver.
5. Chequeos de riesgo: badges largos (`PENDIENTE VALIDACIÓN TÉCNICA`) a 390 px sin desborde; `grep` de `<button className=` crudos y de `text-[1[01]px]` restantes.
6. `/confirmar`: subagente `revisor-sics` sobre el diff de cada commit; devolución; commit solo con el ok de Lisandro; recordar commits pendientes de push.

## Fuera de alcance
Lógica de negocio, RPC, migraciones, flujograma (no cambia el circuito), estética Linear (Fase 3), movimiento (Fase 4), pruebas de resistencia (Fase 5).
