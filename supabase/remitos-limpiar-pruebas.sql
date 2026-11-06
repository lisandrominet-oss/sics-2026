-- Limpieza de datos de prueba del módulo Remitos (NO es una migración: se corre a mano).
-- Borra solo lo que cuelga de ítems con código TEST-* : despachos y egresos que los usan, sus recepciones,
-- movimientos de stock en obra, historial y archivos registrados.
-- Los archivos del bucket remito-files no se pueden borrar por SQL (Supabase lo bloquea): quitarlos desde
-- Storage → remito-files, carpetas con el id de cada despacho de prueba.
begin;
create temp table _t_disp on commit drop as
  select distinct l.dispatch_id as id from remito_dispatch_lines l
  join remito_items i on i.id = l.item_id where i.code like 'TEST-%';
create temp table _t_egr on commit drop as
  select distinct l.egress_id as id from remito_egress_lines l
  join remito_items i on i.id = l.item_id where i.code like 'TEST-%';

delete from remito_events where entity = 'dispatch' and entity_id in (select id from _t_disp);
delete from remito_events where entity = 'egress' and entity_id in (select id from _t_egr);
delete from remito_events where entity = 'item' and entity_id in (select id from remito_items where code like 'TEST-%');
delete from remito_site_movements where (ref_type = 'dispatch' and ref_id in (select id from _t_disp))
                                     or (ref_type = 'egress' and ref_id in (select id from _t_egr))
                                     or item_id in (select id from remito_items where code like 'TEST-%');
delete from remito_files where dispatch_id in (select id from _t_disp);
delete from remito_dispatches where id in (select id from _t_disp);   -- líneas y recepciones caen por cascade
delete from remito_egresses where id in (select id from _t_egr);      -- líneas caen por cascade
delete from remito_items where code like 'TEST-%';
commit;
-- Si no queda ningún despacho ni egreso real, repone los contadores:
-- select setval('public.remito_internal_seq', 1, false); select setval('public.remito_egress_seq', 1, false);
