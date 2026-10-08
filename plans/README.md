# Planes de movimiento — Fase 4 (SICS)

Generados con `/improve-animations` (asesora, no decide) sobre el commit `7b9c50e`. Reglas de la fase: CSS nativo con los tokens de `tailwind.config.ts`, Tailwind 3, sin librerías nuevas, `prefers-reduced-motion` respetado, nada > 360 ms, salida más rápida que entrada, sin animar acciones de teclado, escalonado de 30-80 ms solo en listas del dashboard. Decisiones de Lisandro: D1 solo fade de 160 ms al entrar a una página; D2 contadores de 300 ms sin arrancar de 0; D3 medir antes de tocar `loading.tsx`; D4 salida del Modal sí.

| # | Plan | Severidad | Commit | Estado |
|---|---|---|---|---|
| 001 | Tokens de movimiento y presión única (`scale`) + `transition-all` fuera | ALTA | A | TODO |
| 002 | Entrada de página, escalonado de filas y contadores | ALTA | B | TODO |
| 003 | Brillo de los esqueletos solo con `transform` | MEDIA | A | TODO |
| 004 | Acordeones de Contratos: curva, tiempos y contenido que no desaparece | MEDIA | C | TODO |
| 005 | Salida animada del Modal (y `ConfirmProvider`) | MEDIA | C | TODO |
| 006 | `loading.tsx` y parpadeo del menú (condicional a la medición D3) | MEDIA | B | TODO (solo con aviso a Lisandro) |

Orden: 001 → 003 → 002 → (006 si corresponde) → 004 → 005. 001 define los tokens/keyframes que usan los demás; 005 agrega keyframes de salida a la misma config.
Cada commit se cierra con `npx tsc --noEmit | grep -c "error TS"` = 83, `/review-animations` sobre el diff, `revisor-sics`, prueba en Chrome y el "ok" de Lisandro. Nunca `git push`.
