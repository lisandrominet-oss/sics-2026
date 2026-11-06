-- Limpieza de datos de prueba del módulo Remitos (NO es una migración: se corre a mano).
-- Borra solo lo que cuelga de ítems con código TEST-* y de los despachos que los usan.
-- Si hay archivos en el bucket remito-files de esos despachos, borrarlos antes por la API de Storage.
begin;
create temp table _t_disp on commit drop as
  select distinct l.dispatch_id as id from remito_dispatch_lines l
  join remito_items i on i.id = l.item_id where i.code like 'TEST-%';
delete from remito_events where entity = 'dispatch' and entity_id in (select id from _t_disp);
delete from remito_events where entity = 'item' and entity_id in (select id from remito_items where code like 'TEST-%');
delete from remito_files where dispatch_id in (select id from _t_disp);
delete from remito_dispatches where id in (select id from _t_disp);  -- las líneas caen por cascade
delete from remito_items where code like 'TEST-%';
commit;
-- Si no queda ningún despacho real, repone el contador del N° interno:
-- select setval('public.remito_internal_seq', 1, false);
