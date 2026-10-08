# Fase 5 — Resistencia (`/break-ui`) · SICS

> Informe de la Fase 5 de `docs/plan-ux-nivel-2.md`. Corrido el 2026-10-07/08 con un arnés temporal de datos falsos (`app/dev-break`, borrado antes del último commit) que además **bloquea en el navegador cualquier request a Supabase** (`/rest/v1`, `/rpc`, `/storage/v1`, `/functions/v1`). Nunca se tocó producción.

## Commits
| Commit | Contenido |
|---|---|
| A `9f9e8ae` | Fechas (`formatSqlDate`, zona fija en `formatDate`), `SicsList`, detalle de SIC, `InfoItem`, `PageHeader`, `SicActions`, `UserAvatar`, `Modal`, `PromptDialog`, buscador del Tablero |
| B `ef944d2` | `ItemsEditor`, `NuevaSicForm`, `UsersTable`, `StaffUsersManager` |
| (aparte) | `ItemsEditor`: claves estables por tarjeta (archivo que se mostraba ≠ archivo que se subía al quitar un artículo) |
| C | `ContractsList`, `ContractDetail` (incluye columna Período), `ContractForm` |

## Cómo se midió
`window.__measure` en una pestaña del arnés: crea un iframe del ancho pedido (320, 390, 1024, 1100, 1280), espera el render y mide el desborde horizontal de la página (`scrollWidth − ancho`) más los elementos cuyo borde derecho se sale sin estar dentro de un contenedor con scroll; `__clip` busca elementos recortados por un `overflow-x:hidden`. Datos: Demo, Peor caso, Vacío, Uno, 1.000. Claro y oscuro (`localStorage.sc_theme`).
Límites declarados: el zoom real de 200 % (que agranda el texto) no se reproduce con un iframe angosto; táctil real, iPhone y movimiento reducido en vivo no se probaron; la página `app/sic/[id]` es de servidor y se probó con una **réplica de su marcado** más los componentes reales.

## Valores de peor caso usados (para rearmar el arnés)
- Nombres: `Aleksandra Wiśniewska-Kowalczyk`, `Jo`, `🦊 Fox`, `👩🏽‍💻 Priya`, `王秀英`, `María José de la Cruz y Fernández`, `""`, `null`, `  Sam   Lee `, `dana`.
- Emails (solo `example.com`): `bartholomew.fitzgerald@northwind-industries-holdings.example.com`, `a@b.co`, `first.last+billing-notifications@example.com`, `ops@sub.department.region.example.co.uk`.
- Asuntos: 200+ caracteres, `RODAMIENTO-SKF-6205-2RS1/C3-URGENTE-REPOSICION-STOCK-MINIMO`, `<script>alert(1)</script> &amp; **negrita**`, con salto de línea.
- Archivos: `IMG_20250914_183022_HDR_portrait_edited_edited.HEIC`, `Q3 Board Deck — FINAL (revised) v12 [approved by legal].pdf`.
- Montos: `0`, `1`, `1284`, `12345678.9`, `1512000000` (ARS), `-42.5`, `null`, USD `98765432`.
- Cantidades: `0,005`, `999999999999`. Listas: 0, 1, 14, 50 y 1.000 filas; usuarios 300.
- Contratos: 5 ítems en uno, 36 y 120 cuotas, `internal_number` múltiples (`SIN-001, SIN-002, SIN-003`), vencimientos de −10, 1, 40 y 400 días, proveedor de 80 caracteres.
- Los 14 estados de SIC (el más largo: "Pendiente aprobación del jefe", 29 caracteres).

## Hallazgos verificados en pantalla y resueltos
- **"Necesaria para" con el día anterior y hora inventada** (`6/10/26, 9:00 p. m.` en vez de `7/10/26`): `needed_by_date` es `date`. Ahora `formatSqlDate`. Además `formatDate` usa `America/Argentina/Buenos_Aires` (en Vercel/UTC las horas del detalle de SIC salían 3 h corridas y había desfase de hidratación).
- Detalle de SIC desbordaba 340/270 px a 320/390 px (nombres de archivo, select de proveedor): 0 ahora.
- Monto y fecha desaparecían en el Tablero por debajo de 640 px; "Ver" recortado a 320 px.
- Usuarios: columna fija de 280 px a 390 px tapaba Rol/Área/Guardar; ahora 176 px. Select de planta largo ensanchaba la fila (+114/184 px de desborde).
- Contratos: tarjetas de dinero con ARS de 10 dígitos desbordaban la página a 1024/1100 px (113/37 px); pestañas del detalle desbordaban 116/46 px a 320/390; filtros de contratos desbordaban 306/236 px.
- Avatares: `\ud83eF` con emoji; "J" para "Jo".
- Columna **Período**: 99 px de ancho, nunca entraba en una línea; ahora en dos líneas ("1/1/24" / "→ 31/1/24").
- `ItemsEditor` con `key={index}`: al quitar el ítem 1 de 3 con archivos `a/b/c`, la pantalla mostraba `a, b` y el estado tenía `b, c`. Reproducido y corregido.

## Frágiles: NO tocados (para decidir)
- **Select "Taller" de Nueva SIC**: `required` + primera opción de valor vacío → el navegador la trata como placeholder y no deja enviar con "Taller" (confirmado: `checkValidity()` = false). Decisión de negocio.
- Sin `maxLength` en ningún campo ni `CHECK` de largo en las migraciones (los `CREATE TABLE` base no están en el repo).
- Listas sin paginar: Tablero con tope silencioso de 100 SIC; Usuarios sin buscador (tope de 1.000 de PostgREST); Contratos con consultas de >1.000 filas que podrían truncar totales sin aviso; 120 RPC por cuota (N+1) en `app/contratos/[id]/page.tsx:72-82`; exportar a Excel con `.in("sic_id", ids)` sin paginar.
- `SicActions`: todos los botones muestran spinner a la vez (`loading` compartido); "Eliminar" archivo sin confirmar; subida de un archivo por vez.
- `maximumFractionDigits: 0` oculta centavos (`formatAmount`, `lib/contracts.ts`).
- `ProviderRow` (`formatDate` local) y `ContractDetail:~1721` (ya corregido en C) mostraban hora sin zona fija.
- `formatDateOnly` de `lib/contracts.ts` se corre un día fuera de zonas al este de UTC (hoy los usuarios están en Argentina).
- `reference_link` sin validar esquema `https?:`; URL firmada de 300 s en `FilePreview` sin `onError`.
- Campana: `aria-label` dice "20 pendientes" con tope de 20.
- `ProviderPanel` agrupa por nombre de proveedor (dos proveedores con el mismo nombre se funden).
- Tarjetas de dinero a 1024-1535 px con montos extremos (ARS de 10+ dígitos): no desbordan pero el número se parte en dos líneas.
- Tipos de cantidad: la UI solo admite 2 decimales (`step 0.01`), mal para kg/m; sin tope máximo.

## Pendientes heredados de Fase 4
1. Período → resuelto en C.
2. "Dip" del fade `page-in` al venir de un `loading.tsx` → descartado de Fase 5; se resuelve con el layout compartido de Fase 6.
3. Menú que pierde sus links ~0,6 s (cada página renderiza su `AppShell`) → Fase 6 (`app/(app)/layout.tsx`); Fase 5 no lo vuelve urgente.
4. Para probar a mano: iPhone real (presión `.97`, bottom-sheet, drawer, zoom al enfocar, toasts sobre la barra segura, rotación), "Reducir movimiento" en macOS/iOS, y zoom 200 % de Chrome en Tablero, Nueva SIC y Contratos.
