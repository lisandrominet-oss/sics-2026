# SICS / sics-2026 (Sistema de Compras de SerInd)

Circuito de compras interno: SIC (Solicitud Interna de Compras) con roles emisor → jefe de área → Compras → Gerencia → Pañol, más módulo de Contratos. Proyecto **separado** de miconect-web. El método de trabajo (EPCC, no push, secretos) está en `~/.claude/CLAUDE.md`.

## Stack y dónde está qué
- Next 14.2 (App Router) + React 18 + Tailwind 3 + Supabase (`@supabase/ssr`). Repo `lisandrominet-oss/sics-2026`; Supabase `compras-ser-ind` (ref `tzwduipcmtulcutijjxc`); Vercel `compras-ser-ind`. **No existe una base de pruebas**: el dev server usa producción.
- Toda la lógica de transición de estados vive en **funciones RPC `SECURITY DEFINER` de Postgres**, con RLS restrictiva (solo admin escribe directo). El front solo llama RPCs.
- Roles: admin, gerencia, compras, panol, area (= "Jefe de área"), operativo. "Planta" en la base = área. "Ver como" (`acting_as_role`) permite al admin simular roles.
- Migraciones en `supabase/migrations/` (nombre `AAAAMMDDHHMMSS_descripcion.sql`). Se aplican **en vivo con el MCP de Supabase** y además se guardan como archivo.
- `lib/database.types.ts` se regenera cuando cambia el schema.
- UI en `components/ui/*` (Button, Card, Badge, Modal, Skeleton, EmptyState), avisos con Sonner (`lib/notify.ts`), confirmaciones con `useConfirm`.

## Comandos
- Dev: `npm run dev` (puerto 3000; `.claude/launch.json` → `sistema-compras-dev`).
- Typecheck: `npx tsc --noEmit`. **Hoy hay ~83 errores previos** (mayormente `SicActions.tsx`, por tipos de Supabase nullables). Verificar que el cambio **no suma errores nuevos** comparando el conteo (`npx tsc --noEmit | grep -c "error TS"`).
- Build: `npm run build`, pero ojo: `next.config.js` tiene `ignoreBuildErrors` y `ignoreDuringBuilds`, así que **el build no detecta errores de tipos ni de lint**. El typecheck de arriba es la verificación real.
- **No hay tests ni config de ESLint** (`next lint` pediría configurarlo): no correrlo.
- Modo oscuro: tras agregar clases de color nuevas, `node scripts/generar-modo-oscuro.js` regenera `app/dark-theme.css`.
- Flujograma: `bash docs/flujograma-sic-src/regenerar.sh` (debe imprimir `PROBLEMAS: 0`; genera el PDF con Chrome headless).

## Reglas del proyecto
- Cambios de negocio no triviales: preguntar roles, montos y permisos antes de codear (ya hubo roles que no estaban en el pedido original).
- Antes de dar una RPC o migración por buena: **probarla contra la base real con usuarios simulados dentro de una transacción que se deshace**. Leer el código no alcanza (fallaron casts de enum así).
- Cualquier cambio de roles, estados, tope de Gerencia, tipos de compra, avisos o permisos de lectura de las SIC implica actualizar el **flujograma** (`docs/flujograma-sic-src/build.py` y `ROWS` de `make_html.py`) y commitear los 4 archivos de `docs/`.
- Datos personales y correos reales NO van en migraciones ni en el repo (usar `@test.invalid` para pruebas).
- Una sesión que dice "ya se corrigió X" puede estar desactualizada: verificar el archivo real (ej. `@supabase/ssr` debe seguir en `^0.12.7`).
- Si se levanta otro dev server (ej. `npx next dev -p 3200`), usar ese puerto para la prueba visual.

## Verificación antes de dar algo por listo
1. `npx tsc --noEmit` sin errores nuevos respecto de la base.
2. Cambio de schema o RPC: probado en transacción reversible, tipos regenerados, migración guardada.
3. Cambio visual o de flujo: probar en `http://localhost:3000` con la skill `probar-en-chrome`, en claro y oscuro. Con Chrome se usa tu sesión real; el login con Google no se automatiza.
4. Devolución con `/confirmar`.
