# Pestaña "Contratos" de SICS — especificación v1

Estado: **confirmada, en implementación**. Definida con Lisandro el 30/09/2026 (conversación del proyecto Mireg), revisada contra el código real y confirmada el 30/09/2026 (conversación de sics-2026).

## 0. Decisiones confirmadas tras la revisión

- **Migraciones versionadas en el repo** desde este módulo en adelante, en `supabase/migrations/` (hasta ahora el proyecto no tenía esa carpeta; las migraciones se aplicaban directo contra producción sin dejar archivo en git).
- **Alertas calculadas al vuelo**, sin tarea programada (cron): se recalculan cada vez que alguien de Compras abre la pestaña, igual que ya funciona hoy la campanita de notificaciones de SICs. `contract_alerts` guarda únicamente qué alertas fueron marcadas "atendidas". Se descartó un cron real (pg_cron / Vercel Cron) porque hoy no hay infraestructura de tareas programadas en el proyecto y la única razón real para tenerlo sería poder mandar el email de la sección 4.5 — que queda para v2. Cuando se sume el email, se agrega el cron junto con él.
- **Email fuera de v1**, queda para v2. Confirmado que hoy SICS no manda ningún email (no hay Resend/SMTP/SendGrid ni nada similar en el proyecto); el único aviso existente es la campanita dentro de la app.
- **Nombres de tablas y del bucket de archivos (`contract-files`) tal como están especificados** en este documento, sin cambios.

## 1. Objetivo

SerInd alquila máquinas, camionetas y herramientas de terceros. Hoy lleva unos 7 contratos en un Excel a mano y no puede ver cuántas cuotas se pagaron, cuántas faltan, cuándo vencen ni cuánto cuesta cada mes. La pestaña **Contratos** reemplaza ese Excel y además controla cada factura contra lo que debería cobrar el proveedor.

Es un gasto a controlar: SerInd es quien alquila, no quien cobra.

## 2. Permisos

- Solo roles `compras` y `admin` (enum `user_role`: admin, gerencia, compras, panol, area).
- Gerencia, pañol y áreas **no ven nada** de contratos: ni la pestaña, ni los montos, ni los archivos.
- Tiene que estar aplicado **en la base de datos** (RLS en todas las tablas nuevas) y **en el almacenamiento de archivos**, no solo ocultando el menú. Un PDF de contrato no debe abrirse con un link si el usuario no tiene el rol.
- Hay que decidir cómo se trata a un `admin` que está usando "actuar como" otro rol (`acting_as_role`): propuesta, la base siempre lo deja pasar por ser admin real, y la interfaz oculta la pestaña según el rol que está simulando.
- Los avisos llegan solo a usuarios con rol `compras`.

## 3. Modelo de datos (propuesta; ajustar a las convenciones reales del repo)

Las tablas actuales tienen nombres en inglés y valores de enum en español. Nombres sugeridos, en el mismo estilo.

**`contracts`** — un contrato agrupa equipos de un mismo proveedor que comparten fechas y condiciones. Si dos equipos del mismo proveedor tienen vencimientos distintos, son dos contratos.
- proveedor (`providers`), planta o proyecto (`plants` / `projects`), SIC de origen (opcional, `sics`), responsable (usuario de compras)
- inicio, vencimiento, **día de corte = día de inicio** (ver 4.1)
- tipo de renovación: `automatica` | `expresa` | `sin_renovacion`; plazo de renovación en meses; días de preaviso (0 si no aplica)
- estado: `vigente` | `por_vencer` | `vencido` | `devuelto`. Solo `devuelto` se guarda; los otros se calculan por fechas.
- fecha y acta de devolución, notas

**`contract_items`** — cada equipo del contrato.
- tipo: `maquina` | `camioneta` | `herramienta`
- descripción e identificador (número interno, patente o serie)
- **historial de tarifas** con vigencia (`contract_item_rates`): tarifa fija mensual en USD **neta de IVA**, horas incluidas por mes, tarifa por hora excedida en USD, regla de exceso (ver 4.2)

**`contract_usage`** — horas de uso por ítem y período: horas, informe del sector adjunto, y si la regla es manual, el monto esperado en USD con su nota. Quién lo cargó y cuándo.

**`contract_installments`** — un registro por contrato y período, generado automáticamente desde el inicio hasta el vencimiento. Se genera el período siguiente al registrar una renovación.

**Comprobantes del proveedor** (`provider_invoices` + `provider_invoice_lines`): factura, nota de crédito o pago. **Pertenecen al proveedor**, no al contrato, porque el proveedor emite una sola factura mensual que discrimina los equipos.
- número, fecha de emisión, **dólar venta BNA que figura en la factura** (pesos por USD), neto, IVA, total en pesos, archivo
- líneas: cada una apunta a un ítem (o al total) de un contrato y período, con su importe neto
- un pago apunta a la factura que cancela
- estado `vigente` o `anulado`, con quién, cuándo y por qué. **Nunca se borra.**
- Diseñar pensando en que en el futuro también se vinculen a una SIC, pero en v1 **no se toca `sic_files`**.

**`contract_documents`** — documentos con tipo (`contrato`, `adenda`, `condiciones`, `seguro`, `acta_devolucion`, `informe_horas`, `otro`) y **fecha de vencimiento opcional**. Cuelgan de uno de tres niveles: proveedor (constancias, datos bancarios, seguros generales), contrato (contrato firmado, adendas, seguro de la máquina, documentación del equipo) o cuota (informe de horas, remitos).

**`contract_events`** — historial de cambios: quién, qué y cuándo, con valor anterior y nuevo. Incluye renovaciones, cambios de tarifa, aceptación de diferencias y anulaciones.

**`contract_alerts`** — avisos generados, con estado pendiente o atendida, quién la atendió y cuándo.

La tolerancia de diferencia (por defecto 1%) va en `app_settings`.

## 4. Reglas de negocio

### 4.1 Períodos

Cada período corre **desde el día de inicio de cada contrato**: un contrato que empieza el 15 tiene períodos del 15 al 14. Si empieza el 31, se usa el último día de los meses más cortos.

### 4.2 Cuota esperada

Por ítem y período, según la tarifa vigente al inicio del período:

```text
Modo "franquicia + hora excedida":
  exceso_hs     = max(0, horas_usadas − horas_incluidas)
  esperado_USD  = tarifa_fija + exceso_hs × tarifa_por_hora_excedida

Modo "manual":
  esperado_USD  = monto cargado por Compras, con nota obligatoria
```

Los valores de los contratos varían (200 horas y US$25 son solo un ejemplo). Las formas de cobrar el exceso también: cualquier regla nueva (por kilómetro, por tramos, por día) se agrega como un modo adicional cuando un contrato la necesite. Dejar la regla como un campo del ítem, no como lógica fija.

### 4.3 Comparación con la factura

```text
esperado_ARS  = esperado_USD × dólar de la factura
diferencia    = neto facturado (factura − notas de crédito) − esperado_ARS
```

- Se compara **por línea de equipo y por total**.
- Se marca si la diferencia supera la tolerancia (1% ajustable).
- Validar que total = neto + IVA al cargar (tolerancia de un peso).
- Si se carga mal el dólar, la diferencia sale enorme y se marca sola.
- Las horas las carga Compras desde el informe del sector (el parte diario del operador que se envía al proveedor) y deja el informe adjunto. Si el proveedor factura más horas que las registradas, queda marcado antes de pagar.

### 4.4 Estado de la cuota

`pendiente_de_factura` → `facturada` → `pagada`. Con diferencia: `con_diferencia`. Si alguien usa **Aceptar diferencia** queda `diferencia_aceptada`, con usuario, motivo, monto y fecha. Una nota de crédito descuenta del período correcto.

### 4.5 Renovación y alertas

Regla única para todos los tipos de renovación:

```text
fecha_limite = vencimiento − días_de_preaviso
```

- Contrato **automático**: es el último día para avisar que no se renueva.
- Contrato **expresa**: es el último día para decidir renovar o devolver.
- Alertas a **60, 30 y 15 días antes de la fecha límite**. Si el aviso no se atiende, sigue apareciendo en el panel hasta que alguien de Compras lo marque como atendido. **Sin escalamiento a administrador** (pedido explícito).

Otros avisos, con el mismo esquema 60/30/15: documentos por vencer (seguros, etc.) y cuotas con diferencia.

Envío: a todos los usuarios con rol `compras`, dentro del sistema (usar el mecanismo de notificaciones actual) y por email. **Verificar si SICS ya envía emails**; si no, hablar con Lisandro antes de sumarlo.

### 4.6 Moneda y totales

- Las tarifas y el total comprometido a futuro se muestran en **USD**.
- En pesos solo se muestra una estimación, marcada como tal, con el dólar de la última factura cargada (y su fecha).
- No depender de ninguna fuente externa de cotización.

## 5. Pantallas y acciones

- **Lista de contratos:** equipo(s), proveedor, planta o proyecto, tarifa mensual, inicio, vencimiento, cuotas pagadas y restantes, estado. Filtros por estado, proveedor y tipo de equipo. Exportar a Excel.
- **Ficha del contrato**, con solapas: datos · ítems y tarifas · documentos (con vencimientos marcados) · cuotas · historial.
- **Cuota:** esperado, facturado, notas de crédito, pagado, diferencia y estado; botón para cargar horas del mes.
- **Panel de resumen:** costo del mes, total comprometido a futuro (USD), contratos por vencer, documentos por vencer, cuotas con diferencia, barra de avance pagado contra valor total por contrato.

Botones: Nuevo contrato · Agregar ítem · Registrar ajuste de tarifa · Cargar horas del mes · Cargar factura / nota de crédito / pago · Aceptar diferencia · Agregar documento · Agregar nota · Renovar · Devolver equipo y finalizar contrato · Anular comprobante · Exportar a Excel.

- **Renovar:** actualiza el vencimiento, genera los períodos nuevos y deja el valor anterior en el historial. No pisa los períodos pasados.
- **Devolver y finalizar:** exige el acta de devolución adjunta, cancela las cuotas futuras y marca el contrato como `devuelto`.

## 6. Fuera de alcance de v1

Redactar contratos o firma electrónica · lectura del PDF del contrato con IA · lectura del QR de las facturas · reglas por kilómetro, por tramos o por día (se suman cuando un contrato las pida) · días de máquina parada y reclamos · horas por GPS · calendario · comparar alquilar con comprar · calificación del proveedor · importación desde el Excel actual (Lisandro carga los contratos a mano).

## 7. Criterios de aceptación (pruebas mínimas)

1. Un usuario `area`, `panol` o `gerencia` no puede leer contratos, comprobantes ni archivos: ni por la interfaz, ni por la API, ni por un link al almacenamiento.
2. Ejemplo numérico: fijo US$4.000, 200 hs incluidas, US$25 por hora excedida, 230 hs, dólar $1.500 → esperado US$4.750 = $7.125.000. Una factura por ese importe da diferencia cero.
3. Una factura con varios equipos se reparte por línea y marca solo la línea que no coincide.
4. Una nota de crédito reduce lo facturado del período correcto.
5. Un dólar mal tipeado en la factura genera una diferencia marcada.
6. Contrato que empieza el 15: los períodos van del 15 al 14. Contrato que empieza el 31: los meses cortos usan su último día.
7. La fecha límite es vencimiento − preaviso y las alertas salen a 60, 30 y 15 días antes, solo a usuarios `compras`.
8. Un comprobante anulado no se borra y queda el registro de quién, cuándo y por qué.
9. Aceptar una diferencia registra usuario, motivo, monto y fecha.
10. Devolver un equipo exige el acta y cancela las cuotas futuras.
11. Cambiar una tarifa no altera las cuotas ya pasadas.

## 8. Notas para quien implemente

- Leer primero el código existente: tablas `providers`, `provider_files`, `sic_files`, `plants`, `projects`, `app_settings`, `AppShell` (menú), `NotificationsBell` y cómo se hacen hoy las subidas seguras de archivos. Seguir esos patrones.
- El repositorio no tiene carpeta `supabase/migrations`. Confirmar cómo se versionan las migraciones y dejarlas versionadas en el repo.
- Después de crear las tablas, correr los controles de seguridad de Supabase y revisar que no haya tablas sin RLS.
- No hay IA en esta función: es todo cálculo determinístico.
