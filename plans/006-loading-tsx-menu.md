# 006 — `loading.tsx` y parpadeo del menú (CONDICIONAL)

- **Status**: DESCARTADO en la Fase 4. Medición (dev, ruta fría Tablero → Contratos): a los 611 ms aparece el esqueleto con 0 links en el menú y a los 1200 ms vuelven los 4: el menú sí desaparece ~0,6 s. Se deja para la Fase 6 con un layout compartido `app/(app)/layout.tsx`.
- **Commit**: 7b9c50e
- **Severity**: MEDIUM
- **Category**: Cambios que teletransportan / Cohesión
- **Estimated scope**: borrar 6 archivos + lo que quede sin uso de `LoadingFrame.tsx`

## Problem
Cada página renderiza su propio `<AppShell>` (14 páginas), así que el menú se desmonta y remonta en cada navegación. Las 6 rutas con `loading.tsx` (`app/dashboard`, `app/contratos`, `app/contratos/[id]`, `app/contratos/nuevo`, `app/proveedores`, `app/sic/[id]`) muestran `LoadingFrame` (menú falso con barras grises) hasta que llega la página real: el menú debería verse links → barras → links durante ~0,6 s. Fase 3 midió el tiempo pero no pudo ver el parpadeo.

## Target
1. **Medir antes de tocar nada** (Chrome, 1280 y 390 px): navegar Tablero → SIC → Contratos con capturas cuadro a cuadro (`document.getAnimations()`/capturas seguidas) y registrar si el menú desaparece y reaparece.
2. Si **no** molesta: no hacer nada y cerrar el plan como DESCARTADO.
3. Si molesta: **avisar a Lisandro** con la evidencia antes de borrar. Opciones a proponerle: (a) borrar los 6 `loading.tsx` y las piezas de `LoadingFrame.tsx` que queden sin uso (`Skeleton` y `SkeletonRows` se siguen usando en `app/dashboard/page.tsx` y `NotificationsBell.tsx`); (b) layout compartido `app/(app)/layout.tsx` con el `AppShell` (solución de fondo, cambio propio para la Fase 6: toca 14 páginas y la carga del usuario).

## Boundaries
No agregar transiciones al placeholder del menú (el problema es que reemplaza al menú real, no cómo se ve). No borrar nada sin el aviso.

## Verification
Tras un borrado aprobado: `tsc` = 83, `grep -rn LoadingFrame app components` sin referencias huérfanas, navegación probada en Chrome sin parpadeo del menú.
