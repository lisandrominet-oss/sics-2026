-- PENDIENTE DE APLICAR (edita datos reales: requiere el ok de Lisandro).
--
-- Las notas del recorrido escritas antes de 20261012100000 llevan monto y proveedor en texto libre
-- ("Monto cargado: 125000", "... — proveedor X", "Monto: N. Proveedor: X"). Un operativo o un jefe de
-- otra área que lea el recorrido de una SIC las vería. Se dejan las mismas notas sin esos datos.
update public.sic_events
set note = regexp_replace(note, ' — proveedor .*$', '')
where note like 'Clasificada como cuenta corriente — proveedor %';

update public.sic_events
set note = regexp_replace(note, '^Monto cargado: [0-9]+(\.[0-9]+)?', 'Monto cargado')
where note ~ '^Monto cargado: [0-9]';

-- Compra directa: el nombre del proveedor puede llevar puntos ("S.A."), así que no se intenta recortar
-- por texto: la nota queda con la parte fija (y se pierde el comentario libre, si lo hubo).
update public.sic_events
set note = 'Clasificada como compra directa'
      || case when note like '%Supera el tope%' then '. Pasa a Gerencia' else '' end
where note like 'Clasificada como compra directa. Monto:%';
