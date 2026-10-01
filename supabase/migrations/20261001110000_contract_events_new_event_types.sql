-- contract_events tenía una restricción que solo permitía 4 tipos de evento
-- (renovacion, cambio_tarifa, aceptar_diferencia, anulacion). Al agregar "Editar
-- contrato" y "Editar equipo" los nuevos event_type ('edicion_fechas',
-- 'edicion_equipo', 'numero_interno') violaban esa restricción.

alter table contract_events drop constraint contract_events_event_type_check;
alter table contract_events add constraint contract_events_event_type_check
  check (event_type = any (array['renovacion', 'cambio_tarifa', 'aceptar_diferencia', 'anulacion', 'edicion_fechas', 'edicion_equipo', 'numero_interno']::text[]));
