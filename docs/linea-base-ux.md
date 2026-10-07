# Línea base UX (Fase 0) — 2026-10-07

Punto de comparación para cerrar el plan de `docs/plan-ux-nivel-2.md`. Medido sobre `main` en `e5746bb`, antes de tocar código de la Fase 1.

## Typecheck
`npx tsc --noEmit | grep -c "error TS"` → **83** (coincide con la base conocida; la Fase 1 no debe sumar errores).

## Build (`npm run build`, Next 14.2.15)
Compila. El build no valida tipos ni lint (`ignoreBuildErrors`/`ignoreDuringBuilds`).

| Ruta | Size | First Load JS |
|---|---|---|
| `/dashboard` | 3.9 kB | 277 kB |
| `/sic/[id]` | 9.67 kB | 283 kB |
| `/sic/nueva` | 3.4 kB | 184 kB |
| `/contratos` | 5.12 kB | 278 kB |
| `/contratos/[id]` | 10.3 kB | 191 kB |
| `/usuarios` | 4.53 kB | 185 kB |
| `/admin/usuarios` | 4.18 kB | 184 kB |
| `/login` | 3.15 kB | 160 kB |
| Compartido por todas | — | 87.2 kB |
| Middleware | — | 87.5 kB |

Para la Fase 6: `/dashboard`, `/contratos` y `/sic/[id]` pesan ~90-100 kB más que el resto; revisar si `xlsx` se carga de entrada en vez de al exportar.

## Capturas
Se guardan fuera del repo. Tomadas desde el sitio de Vercel (código de `main`, rol "Ver como: Compras"), porque el dev server no tenía sesión hasta configurar la redirección de Supabase. El ancho de 390 px se simula con un iframe de 390 px en la misma sesión (Chrome no deja achicar la ventana); no reemplaza una prueba en iPhone.
- Login, escritorio (1456 px), claro y oscuro: tomadas.
- Dashboard, escritorio, claro y oscuro: tomadas. Nueva SIC, escritorio, claro y oscuro: tomadas.
- Dashboard 390 px, claro y oscuro: tomadas. Nueva SIC 390 px, claro: tomada.
- **No tomadas:** login 390 px, Nueva SIC 390 px oscuro, detalle de SIC (el Tablero tiene 0 SIC; crear una escribiría en producción) y Usuarios (el rol "Compras" no tiene esa pantalla; ver como Admin/Gerencia implica cambiar `acting_as_role` en el perfil real).

## Mediciones en 390 px (código de `main`)
- Sin scroll horizontal de página en Tablero y Nueva SIC (`scrollWidth` 390).
- Menú lateral apilado arriba: ocupa casi toda la primera pantalla antes del contenido.
- Campos de Nueva SIC con `font-size` de 14 px (uno de 12 px): iOS hace zoom al enfocarlos.
