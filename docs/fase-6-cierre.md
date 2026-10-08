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
