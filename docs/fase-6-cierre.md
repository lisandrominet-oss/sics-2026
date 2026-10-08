# Fase 6 — Cierre y rapidez · SICS

> Informe de la Fase 6 de `docs/plan-ux-nivel-2.md`. Se completa por commit (A rapidez, B layout compartido, C cierre).

## Commit A — Rapidez

### Tamaño de rutas (`npm run build`, Next 14.2.15)
Medido en una copia aislada del repo (worktree fuera del proyecto) para no pisar el `.next` del dev server. "Antes" = `HEAD` `b360f6c`; "después" = commit A.

| Ruta | Antes (First Load) | Después | Diferencia |
|---|---|---|---|
| `/dashboard` | 279 kB | 186 kB | −93 kB |
| `/contratos` | 281 kB | 189 kB | −92 kB |
| `/sic/[id]` | 285 kB | 193 kB | −92 kB |
| resto de rutas | 159–196 kB | sin cambios | — |
| Compartido por todas | 87.2 kB | 87.2 kB | — |

Causa: `lib/exportSics.ts` y `lib/exportContracts.ts` importaban `xlsx` de forma estática y las usan `SicsList`, `ExportSicButton` y `ContractsList`. Ahora hacen `await import("xlsx")` dentro de la función de exportar. Verificado en Chrome (`/contratos`, sesión real, solo lectura): el chunk `_app-pages-browser_node_modules_xlsx_xlsx_mjs.js` se pide recién al hacer clic en "Exportar a Excel", responde 200, el archivo se genera y no hay errores de consola. Si el chunk no baja (sin conexión), se muestra un aviso en vez de fallar en silencio.

### Otros cambios
- **Blur de overlays**: `backdrop-blur-sm` pasa a `sm:backdrop-blur-sm` en `Modal` y en el fondo del menú móvil (sin blur por debajo de 640 px). La decisión final depende de la prueba de Lisandro en un iPhone real.
- **Tablero**: aviso "Mostrando las primeras 100 solicitudes…" cuando la lista alcanza el tope (la consulta no cambia).
- **`ProviderRow`**: usa el `formatDate` central (zona `America/Argentina/Buenos_Aires`).

## Commit B — Layout compartido `app/(app)/layout.tsx`

### Qué cambió
- Ocho carpetas (`admin`, `contratos`, `dashboard`, `modulos`, `preferencias`, `proveedores`, `sic`, `usuarios`) pasan a `app/(app)/` con `git mv`. Las URLs no cambian. `login`, `pendiente`, `auth`, `page.tsx`, `error.tsx` y `not-found.tsx` quedan afuera (sin menú).
- `app/(app)/layout.tsx` (servidor) lee el perfil con `getCurrentProfile()` (sale del header `x-profile` del middleware, sin consulta extra), calcula `effectiveRole` y renderiza el único `<AppShell>`. **No es el control de acceso**: cada página conserva su `redirect` por rol, y el middleware y las RPC/RLS no cambian.
- Las 14 páginas dejan de renderizar `<AppShell>` (se quitó el wrapper y el import; `git diff -w` muestra solo esas líneas).
- `AppShell`: el contenedor `animate-page-in` lleva `key={pathname}`. Como el shell ya no se remonta, sin la `key` el fade de 160 ms dejaría de correr; con ella corre una vez al cambiar de ruta y no se repite cuando llega la página real desde su `loading.tsx` (desaparece el posible "dip").
- `LoadingFrame` ya no dibuja un menú falso: es solo el contenedor con el ancho de la página (los 6 `loading.tsx` no cambian).
- `NotificationsBell`: antes consultaba al montarse (y el menú se montaba en cada navegación); ahora el menú persiste y vuelve a consultar al cambiar de ruta (una RPC por navegación, igual que antes).

- Ajustes por el shell persistente (hallados por el revisor): la campana cierra su panel al cambiar de ruta (antes se cerraba por el remonte); `UserAvatar` revisa su URL firmada al cambiar de ruta (vence a la hora y antes se renovaba al remontar); el foco no vuelve a la hamburguesa cuando el menú móvil se cierra por tocar un enlace (sí al cerrar con la X). Verificado: al navegar el scroll vuelve arriba (449 → 0, 133 → 0) y el foco queda en la página.

### Medición (Chrome, sesión real, solo lectura, ruta `/contratos` → `/proveedores`)
| | Antes (dev, `HEAD`) | Después (dev, commit B) |
|---|---|---|
| Links del menú durante la carga | 4 → **0** a los 540 ms → 4 a los 973 ms (~430 ms sin menú) | 4 → 4 → 4 (nunca baja) |
| `<aside>` | se remonta | mismo nodo entre rutas |
| Contenedor `animate-page-in` | n/a | uno por ruta; la página real llega en el mismo nodo (el fade no se repite) |
| RPC `get_pending_notifications` | 1 por navegación | 1 por navegación |

Recorrido completo con el layout (Tablero, Nueva SIC, Proveedores, Preferencias, Contratos, Nuevo contrato): menú persistente, ítem activo correcto, sin errores de JS. Menú móvil (iframe de 390 px): abre, navega, se cierra solo, `inert`/`overflow` se restauran, sin scroll horizontal. Claro y oscuro sin diferencias respecto de antes. `/usuarios` y `/admin/usuarios` con "Ver como: Compras" siguen redirigiendo a `/dashboard`.

### Tamaño de rutas (`npm run build`)
| Ruta | HEAD `b360f6c` | Commit A | Commit B |
|---|---|---|---|
| `/dashboard` | 279 kB | 186 kB | 181 kB |
| `/contratos` | 281 kB | 189 kB | 182 kB |
| `/sic/[id]` | 285 kB | 193 kB | 188 kB |
| `/sic/nueva` | 186 kB | 186 kB | 179 kB |
| `/usuarios` | 187 kB | 187 kB | 175 kB |
| `/proveedores` | 189 kB | 189 kB | 178 kB |
Nota: con el shell en el layout, Next reparte distinto los chunks entre rutas, y `/modulos/[slug]` pasa a figurar con 91,5 kB. Son tamaños de build, no medidas de transferencia real: el criterio final de velocidad es el Lighthouse de DevTools.

### Pendiente de mirar en dispositivo
Parpadeo del menú al navegar en un iPhone real, y fade de entrada con "Reducir movimiento".

### Riesgo conocido
El layout no se vuelve a ejecutar en navegaciones suaves, así que los datos del menú (nombre, rol) se actualizan al refrescar. `RoleSwitcher` ya hace `router.refresh()` y el avatar usa un evento propio. Si otra persona te cambia el rol con la sesión abierta, el menú lo refleja recién al refrescar; las páginas y las RPC siguen validando el rol real en cada pedido.

## Medición de producción antes/después (`next start`, Chrome, sesión real, solo lectura)
Dos builds de producción (antes = `b360f6c`, después = commit B), cada uno en su puerto, 3 pasadas por ruta alternando el orden.

| Ruta | JS transferido antes | JS transferido después |
|---|---|---|
| `/dashboard` | 278 kB (14 archivos) | 195 kB |
| `/contratos` | 280 kB | 197 kB |

TTFB y carga: sin diferencia sistemática (292–713 ms, ruido de la red hacia Supabase; al invertir el orden de medición los valores se mezclan). La mejora de A y B se ve en bytes de JS y en que el menú no desaparece, no en el tiempo de respuesta del servidor. **No se pudo medir FCP/LCP**: la pestaña de Chrome estaba en segundo plano (`visibilityState: hidden`) y no emite esas métricas.

## Lighthouse (corrido por Lisandro, 2026-10-08)
Como `dff8008` ya estaba en Vercel, el "antes" no se podía medir ahí: se compararon dos builds de producción locales (`next start`) con la misma base de Supabase, `b360f6c` (antes, puerto 3301) y `dff8008` (después, puerto 3302), con Lighthouse móvil de DevTools, solo Performance, 3 pasadas por pantalla (mediana).

| Pantalla | Antes (`b360f6c`) | Después (`dff8008`) |
|---|---|---|
| Tablero (`/dashboard`) | 100 | 100 |
| Contratos (`/contratos`) | 100 | 100 |
| Nueva SIC (`/sic/nueva`; no hay SIC en la vista "Compras") | 100 | 100 |

**Límite de la medición:** en `localhost` no hay latencia de red ni CDN y el puntaje de Performance se satura en 100, así que no discrimina entre las dos versiones. La diferencia real de las Fases 6 está en los bytes de JS (278 → 195 kB y 280 → 197 kB, ver arriba) y en que el menú no desaparece al navegar. Un Lighthouse sobre el sitio de Vercel (red real, con el throttling simulado de 4G lento) sí podría mostrar la diferencia, pero el "antes" ya no existe ahí; solo se podría correr el "después" como referencia futura.

## Verificación final
- `npx tsc --noEmit | grep -c "error TS"`: 83 (sin contar los huérfanos de `.next/types` que deja un dev server con las rutas viejas; desaparecen con `rm -rf .next` cuando no haya otro server usándolo).
- `git diff package.json`: vacío (sin dependencias nuevas). Sin migraciones ni RPC: el flujograma no cambia.
- `npm run build` compila (dos veces, en copias aisladas).
- `revisor-sics` sobre A y B: sin hallazgos críticos; el importante de B (campana abierta tras navegar) quedó corregido.

## Qué no se pudo ver
- **Aviso del tope de 100 del Tablero**: producción tiene 0 SIC en "Ver como: Compras"; el texto no se vio en pantalla (solo se revisó el código y el tipado).
- **Blur quitado en móvil**: no se pudo apreciar en un celular real; requiere tu prueba (ver abajo).
- **iPhone real, "Reducir movimiento", zoom 200 %**: no se probaron.
- **FCP/LCP**: ver arriba.
- **Movimiento a 60 fps**: la pestaña en segundo plano no avanza animaciones; se verificó por estado del DOM y `getAnimations()`.

## Para probar a mano (iPhone real, tras el deploy)
1. Presión de botones (`.97`) y de tarjetas clicables.
2. Menú lateral: abrir/cerrar, y que **los links no desaparezcan al navegar** (Tablero → Contratos → Proveedores).
3. **Blur**: fondo del Modal (bottom-sheet) y del menú sin blur. ¿Se ve bien? ¿Abre/cierra más fluido? Si preferís el blur, se vuelve a `backdrop-blur-sm`.
4. Zoom al enfocar un campo (debe quedar en 16 px), toasts sobre la barra segura, rotación.
5. Con "Reducir movimiento" (macOS/iOS): sin fade de página, sin presión, sin escalonados; el menú abre sin deslizar.
6. Zoom 200 % de Chrome en Tablero, Nueva SIC y Contratos.

## Frágiles: lo que quedó fuera (con recomendación)
Hechos en esta fase: aviso del tope de 100 en el Tablero y zona fija en `ProviderRow`.

| Frágil | Recomendación |
|---|---|
| Sin `maxLength` ni `CHECK` de largo en la base | Acordar largos por campo; migración (CHECK) + `maxLength` en el front, en una tarea aparte |
| Tablero con tope de 100 (paginación real), Usuarios sin buscador (tope 1.000 de PostgREST), Contratos con >1.000 filas, exportar con `.in("sic_id", ids)` sin paginar | La paginación del Tablero es la más valiosa cuando haya >100 SIC reales. Hoy solo se avisa |
| N+1 de cuotas (`app/(app)/contratos/[id]/page.tsx`, hasta 120 RPC por detalle) | Requiere una RPC nueva que devuelva todas las cuotas juntas (toca la base): consultar antes |
| Centavos ocultos (`formatUsd`/`formatArs`, `maximumFractionDigits: 0`) | Decisión de negocio; puede ensanchar las tarjetas de dinero |
| `formatDateOnly` de `lib/contracts.ts` se corre un día al este de UTC | Sin efecto en Argentina; unificar con `formatSqlDate` en una tarea aparte |
| `SicActions`: spinner global en todos los botones, "Eliminar" archivo sin confirmar, un archivo por vez | "Eliminar" sin confirmar es lo más barato y útil |
| `reference_link` sin validar esquema `https?:`; URL firmada de 300 s en `FilePreview` sin `onError` | Próxima ronda de resistencia |
| Campana: `aria-label` dice "20 pendientes" con tope de 20; `ProviderPanel` agrupa por nombre; cantidades con 2 decimales | Backlog |
| Error de página dentro del shell: `app/error.tsx` ocupa toda la pantalla y oculta el menú | Opcional: `app/(app)/error.tsx` para conservar el menú |

## Trampas nuevas para futuras sesiones
- Mover carpetas de rutas con un dev server corriendo deja `ChunkLoadError` (`_next/undefined`): reiniciar el server y borrar `.next`.
- Para medir sin pisar el dev server de otro chat: worktree fuera del repo (`git worktree add --detach <dir> <commit>`), `node_modules` enlazado y `.env.local` copiado; `npm run build` y `next start -p 33xx`. La cookie de sesión de `localhost` sirve en cualquier puerto. Borrar el enlace a `node_modules` ANTES de `git worktree remove`.
- Con la pestaña de Chrome en segundo plano los temporizadores se frenan a 1 s: medir con `MutationObserver` y `performance.now()`, no con `setInterval`.
- El shell ya no se remonta: cualquier componente del menú que cargue datos al montarse debe volver a hacerlo al cambiar `pathname` (como `NotificationsBell` y `UserAvatar`).
