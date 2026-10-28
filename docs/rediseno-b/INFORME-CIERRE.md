# Rediseño B ("Hoja enmarcada"): informe de cierre

Octubre de 2026. Rama `rediseno-b`, 7 commits locales sobre `main` (sin push). Cambió solo la interfaz: ninguna RPC, rol, estado, ruta, consulta ni dato.

## 1. Qué se hizo

| Fase | Commit | Qué entró |
| --- | --- | --- |
| 0 | `7c4e038` | Maqueta de referencia en `docs/rediseno-b/` |
| 1 | `1037c95` | Tokens claro/oscuro por variables CSS, IBM Plex Sans, marco, menú y barra superior; se borra el parche de modo oscuro (`app/dark-theme.css` y `scripts/generar-modo-oscuro.js`) |
| 2 | `97549f0` | Componentes base (`components/ui/*`), `Recorrido`, `Avatar`, `lib/recorrido.ts` |
| 3 | `8f0d586` | Ingreso, Tablero, Detalle de SIC y Nueva SIC |
| 4 (1) | `4e0f6cb` | Grilla del Roster, detalle de Contrato (cuotas), barrido de emoji e índigo/violeta |
| 4 (2) | `c3b0299` | Anchos unificados del Roster, filtros y botones de texto táctiles, 404, error y pendiente sobre el marco |
| 5 | `082c677` | `/presentacion` (hojas, maquetas, 3 capturas nuevas con datos tapados) y retiro de los alias de color |

Balance: 104 archivos, +1.888 / −943 líneas respecto de `main`.

## 2. Cómo quedó el sistema

- **Identidad:** marco tintado (`frame`) con la hoja blanca (`sheet`) encajada; tinta (`ink`) para lo principal; amarillo (`brand`) solo para lo que espera acción y el tramo actual del recorrido.
- **Color solo por tokens:** `slate` (neutros), `red`/`amber`/`emerald` (estados) y `ink`, `on-ink`, `frame`, `sheet`, `brand`, `on-brand`, `scrim`. Desaparecieron índigo, violeta, celeste, verde azulado, rose y naranja. Colores provisorios: tinta `#101a2b`, amarillo `#f5c400` (un solo lugar: `:root` de `app/globals.css`).
- **Modo oscuro** con neutros reales, por las mismas variables: ya no hay nada que regenerar al sumar clases.
- **Elemento propio de SICS:** el recorrido de cinco tramos (Emisor, Jefe de área, Compras, Gerencia, Pañol).
- **Sin sombras en reposo;** solo `shadow-pop` en lo que flota (menú, diálogo, lista del combobox, toasts, celular de la presentación).
- **Página como documento:** menú y barra sticky, sin paneles con scroll interno.
- **Táctil:** 44 px en celular para campos, botones y filtros (`inputClass`, `filterClass`); los botones de texto suman el área con relleno compensado.

## 3. Números

| | Antes | Ahora |
| --- | --- | --- |
| Lint de estilo (`lint.mjs --app components app`) | 77 FAIL | **0 FAIL**, 5 WARN |
| `tsc` (errores previos) | 83 | 83 (ninguno nuevo) |
| Build | compila | compila |
| Diff en `supabase/`, `lib/database.types.ts`, `middleware.ts`, `lib/supabase`, `lib/pendingSics.ts` | | vacío |

Los 5 WARN restantes son aceptables: `padStart` de un reloj (`EmployeeDetail.tsx:46`), el prefijo de planta en `font-mono` (`PlantsManager.tsx:62`), el separador de 1 px de la columna fija de tablas (`app/globals.css:137`), el `box-shadow: none` de impresión de la presentación y 21 rayas largas repartidas en textos.

Cada fase pasó por el subagente `revisor-sics` antes del commit; no hubo críticos ni importantes sin resolver.

## 4. Pasadas finales

Se hicieron leyendo el código y con pruebas puntuales en el navegador (tu sesión, solo lectura, textos inyectados solo en el DOM local). **No se corrigió nada**: es un informe para que decidas.

### 4.1 `break-ui` (peor caso)

Se probó el Tablero en 390 y 1360 px y la grilla del Roster con asuntos de 120 caracteres, un nombre con diacríticos y guion ("Wiśniewska-Kowalczyk"), un área de 70 caracteres y un nombre de 45.

| # | Gravedad | Dónde | Qué pasa | Arreglo |
| --- | --- | --- | --- | --- |
| 1 | Fragile | Formularios (`NuevaSicForm.tsx`, `ItemsEditor.tsx`, `ContractForm.tsx`, `EmployeeForm.tsx`) | Nueva SIC (5 controles), el editor de artículos (5) y Contratos (19) no tienen ningún `maxLength`; Personal tiene 5 en sus 9 campos de texto y fecha (DNI y CUIL sin tope). Cuentan también selects y fechas, que no necesitan tope. El asunto de una SIC no tiene tope en pantalla: una pegada larga entra y recién se nota en la lista | Definir topes (con el límite real de la columna) y ponerlos en el campo. Es una decisión de datos, no solo de estilo |
| 2 | Fragile | 29 usos de `truncate` en `components/` | Solo 7 llevan `title`; en el resto el texto cortado no se puede leer completo (por ejemplo el detalle bajo cada tramo en `RecorridoPasos`, `components/ui/Recorrido.tsx`) | Sumar `title` donde el texto cortado es un dato |
| 3 | Ugly | Tablero en celular (`DashboardControls.tsx:65-94`) | Búsqueda, orden y dirección ocupan tres renglones: la primera SIC empieza casi a la mitad de la pantalla | Orden y dirección en un solo renglón (`max-sm:flex-1` en el select) |
| 4 | Fragile | `tailwind.config.ts` | Sin los alias, un `bg-indigo-600` escrito a futuro vuelve al índigo por defecto de Tailwind. Hoy lo frena el lint (que marca índigo y violeta), no la configuración | Mover `colors` fuera de `extend` obliga a revisar bordes y anillos por defecto; no se hizo. Alternativa: dejar el lint en la rutina de cierre (ya está en `CLAUDE.md`) |

**Decisiones para vos**
- ¿Topes de largo en el asunto, el artículo y los nombres? Recomendado: sí, en el formulario y en la base juntos, con valores que elijas vos (asunto de 200, por ejemplo).
- ¿Truncar o envolver el asunto en la tabla de escritorio? Hoy trunca en una línea con `title` en el asunto de la fila; recomendado: dejarlo así, porque el detalle muestra el texto entero.

**Lo que aguantó**
- Tablero en 390 px: el asunto se corta en 2 líneas con puntos, la persona y el área en 1, el código y la fecha nunca se mueven, la tira de recorrido no se achata y no hay scroll horizontal (el documento mide 388 de 388).
- Tablero en 1360 px: asunto y persona se cortan con puntos sin empujar el recorrido, el monto ni "Ver"; la insignia "Cta. cte." conserva su forma.
- Roster: el nombre largo se corta en la columna fija sin deformar la grilla ni la fila de totales.
- Iniciales: `Avatar.tsx` y `UserAvatar.tsx` resuelven nombre vacío, una sola palabra y emoji (por caracteres, no por posición).
- Plurales a mano: 1 día/días, 1 solicitud/solicitudes y los avisos del Roster ya contemplan el caso de 1.
- Números y montos: todos con `Intl.NumberFormat("es-AR")` y cifras tabulares en las columnas.
- El nombre de usuario del menú lateral usa `truncate` con `min-w-0`.

**No verificado:** modo RTL (el producto no lo usa), zoom del navegador al 200 % y listas de más de 1.000 filas (el Tablero corta en 100).

### 4.2 `emil-design-eng` (detalle y movimiento)

Búsqueda de los patrones que la skill penaliza en `app/`, `components/` y `lib/`:

| Patrón | Resultado |
| --- | --- |
| `transition: all` / `transition-all` | Ninguno |
| `ease-in` en entradas | Ninguno (curvas `ease-out-expo` y `ease-out`) |
| `scale(0)` o entradas desde la nada | Ninguno: diálogos con `scale-in`/`slide-up` parciales y opacidad |
| Animaciones de más de 500 ms | Ninguna (entre 140 y 320 ms) |
| Estado `:active` en botones | Sí: `.press` baja a 0,97 y `press-soft` a 0,985 en tarjetas clicables; solo con `:not(:focus-visible)` |
| `prefers-reduced-motion` | Respetado en `app/globals.css` y en `/presentacion` |
| Hover pegado en táctil | Resuelto de raíz: `hoverOnlyWhenSupported` en Tailwind, y el único `:hover` suelto (botón de archivo) está dentro de `(hover: hover)` |
| Diálogos | Se cierran con animación de salida, quedan `inert` mientras se van (sin doble envío) |

| Antes | Después | Por qué |
| --- | --- | --- |
| Estados de carga con degradé | Barrido plano (ya hecho en la Fase 1) | Menos ruido y coherente con "sin sombras ni degradés" |
| `tone="violet"` / `tone="sky"` en `Badge` (nombres heredados) | Renombrar a `tipo` (opcional) | Los nombres mienten: hoy se ven neutros. Es limpieza de código, no de pantalla |
| Tres tipos de compra idénticos en gris (hoja de roles de la presentación) | Dejarlos así o diferenciarlos por forma (por ejemplo contorno) | Hoy solo el texto los distingue; coincide con la app real |

Conclusión: no hay nada que corregir en movimiento. Lo anterior es opcional.

### 4.3 `mobile-native` (lo que delata una web en el celular)

| Punto de la skill | Estado |
| --- | --- |
| Hover pegado | Resuelto (ver arriba) |
| Destello al tocar (`-webkit-tap-highlight-color`) | Apagado en `html` |
| Altura de pantalla | `dvh` en diálogos (`max-h-[90dvh]`) y `min-h-dvh` en pantallas sueltas; no hay `100vh` |
| Zoom al enfocar un campo | Todos los campos a 16 px por debajo de 640 px (`app/globals.css`); sin `user-scalable=no` |
| Toque con demora | `touch-action: manipulation` en enlaces, botones y campos |
| Selección al mantener presionado | `user-select: none` solo en botones, no en el cuerpo |
| Muesca y barra inferior | `viewport-fit=cover` y `env(safe-area-inset-*)` en barra superior, menú, diálogos y barra de envío de Nueva SIC |
| Color de la barra de estado | Un `theme-color` por esquema (`#e8ecf2` / `#0d0e10`) y `lib/theme.ts` lo actualiza si el tema elegido en la app difiere del del sistema |
| Pull-to-refresh | Sin `overscroll-behavior: none`: es **a propósito**. La página es un documento y recargar tirando hacia abajo es lo esperado; el menú y los diálogos sí usan `overscroll-contain` |
| Bloqueo del fondo con menú o diálogo abiertos | `body { overflow: hidden }` con restauración |

**Fragile (para mirar en el iPhone):**
- Teclado en Nueva SIC: la barra de envío fija (`sticky bottom-0`) puede quedar tapada o saltar cuando aparece el teclado. Se puede mejorar con `interactiveWidget: "resizes-content"` en el `viewport` de `app/layout.tsx`, pero conviene probarlo en el aparato antes de tocar.
- Los chips de categoría de Proveedores (`rounded-full text-xs`) no llegan a 44 px de alto en celular.

La regla de la skill es la que manda: **nada de esto se da por resuelto sin probarlo en el iPhone.**

## 5. Lo que no se implementó de la maqueta (a propósito)

Porque cambiaban funcionalidad o pedían consultas nuevas:
1. Buscador global en la barra superior (no existe una búsqueda global).
2. Botón de tema en la barra (el tema se elige en Preferencias).
3. Contador de pendientes en el menú (sería una consulta nueva en el layout).
4. Fecha de la SIC más próxima en el aviso del Tablero (consulta extra).

## 6. Decisiones abiertas (tuyas)

1. **Mapa de tramos del recorrido** para servicios y SIC cerradas (por ejemplo `recibida` en Pañol, los servicios que saltean Pañol). Hoy: `lib/recorrido.ts`; si cambia, se actualiza ahí y en el flujograma.
2. **Azul marino exacto** de la indumentaria (hoy `#101a2b`; se cambia en `app/globals.css`).
3. **Colores fijos de los toasts** de error y aviso (`#7f1d1d` y `#92400e`, en `components/ui/AppToaster.tsx`): única excepción a "colores solo por tokens".
4. **`vista-previa/`** (unos 12 MB, con la presentación en HTML y PDF y las maquetas de trabajo, sin versionar): ignorarla en `.gitignore`, borrarla o conservarla afuera del repo. Mientras tanto, no hacer `git add .` ni `git add -A`.
5. **Topes de largo** en los formularios (ver 4.1, punto 1).

## 7. Qué no se pudo verificar

- **iPhone real:** táctil, teclado, barra de estado y "Reducir movimiento" en vivo.
- **Login con Google:** no se automatiza.
- **PDF de la presentación:** debe dar una página por hoja (595×842); lo genera Lisandro desde su Chrome con «Guardar PDF».
- **Mobbin:** no se pudo entrar; las referencias de Contratos y Roster salieron de las maquetas aprobadas.
- Rutas con datos que hoy no existen en la base (por ejemplo contratos con muchas cuotas pendientes) se revisaron con lo que había.

## 8. Antes de subir

1. Revisar este informe y decidir los puntos de la sección 6.
2. Subir la rama `rediseno-b` desde GitHub Desktop y mirar el preview de Vercel. Ojo: apunta a la base de producción; probar solo lectura.
3. Probar en el iPhone: Tablero, Nueva SIC con el teclado abierto, menú lateral, diálogos y el modo oscuro.
4. Mezclar a `main` recién después.

Los planes viejos (`docs/plan-fase-2.md`, `docs/plan-ux-nivel-2.md` y `plans/001-tokens-y-presion.md`) todavía mencionan el script de modo oscuro que se borró; son históricos y no se tocaron. El único residuo en código era un comentario de `app/globals.css` (tablas de columna fija), ya reescrito.
