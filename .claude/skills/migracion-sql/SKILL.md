---
name: migracion-sql
description: Crea y aplica una migración de Supabase en SICS (archivo versionado, aplicación en vivo con confirmación, prueba de la RPC en transacción reversible y tipos regenerados).
disable-model-invocation: true
---

Migración o cambio de RPC para: $ARGUMENTS

La base de SICS es de **producción** (no hay entorno de pruebas). Seguí en orden y no te saltees pasos.

1. **Leer el estado actual**: las migraciones recientes de `supabase/migrations/` y la definición vigente de las funciones que se tocan (con `list_tables` / `execute_sql` de solo lectura). No asumir.
2. **Escribir el archivo** `supabase/migrations/AAAAMMDDHHMMSS_descripcion.sql` (timestamp mayor al último existente). Funciones `SECURITY DEFINER` con `search_path` fijo, chequeo de rol, casts de enum explícitos y registro del evento en `sic_events`. Sin datos personales ni correos reales.
3. **Probar antes de aplicar**: simular los usuarios/roles involucrados y ejecutar la RPC dentro de `BEGIN; ... ROLLBACK;` (la transacción se deshace). Probar el caso feliz y los rechazos por rol/estado.
4. **Aplicar en vivo** con `apply_migration` (el sistema pedirá confirmación a Lisandro: esperarla). Revisar `get_advisors` por seguridad.
5. **Regenerar** `lib/database.types.ts` con `generate_typescript_types` si cambió el schema, y correr `npx tsc --noEmit` comparando con la base de errores.
6. **Flujograma**: si cambió el circuito (roles, estados, reglas), usar la skill `flujograma-sic`.
7. Devolución con `/confirmar`. Avisar explícitamente que la migración **ya está aplicada en producción** aunque el commit esté pendiente.
