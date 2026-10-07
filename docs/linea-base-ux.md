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
Se guardan fuera del repo. Estado:
- Login, escritorio (1456 px), claro y oscuro: tomadas.
- Login 390 px: **pendiente** (la ventana de Chrome no se pudo achicar con `resize_window`; se simula con un iframe de 390 px).
- Dashboard, detalle de SIC, nueva SIC y usuarios, escritorio y 390 px, claro y oscuro: **pendientes** (hace falta iniciar sesión con Google en `localhost:3000`).
