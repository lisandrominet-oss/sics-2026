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
