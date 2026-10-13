-- PENDIENTE DE APLICAR: aplicar recién cuando el front nuevo (que lee sic_finance) esté desplegado en Vercel.
--
-- Cierra la fuga de montos: elimina sics.final_amount y sics.estimated_amount. Hasta que esto se aplique,
-- cualquiera que pueda leer una fila de `sics` (operativo y jefe de la planta, el solicitante, Pañol desde
-- orden emitida) sigue recibiendo estas columnas por la API, aunque la pantalla no las muestre. Desde la
-- migración 20261012100000 el monto vive en sic_finance y las RPC ya no escriben acá.
--
-- Irreversible: antes de borrar se comprueba que todo monto de `sics` que no tenga fila en sic_finance
-- ya esté copiado (si la fila existe, manda sic_finance: puede haberse editado después) y que
-- estimated_amount esté vacío (ninguna RPC ni pantalla lo usa).
do $$
begin
  if exists (
    select 1
    from public.sics s
    where s.final_amount is not null
      and not exists (select 1 from public.sic_finance f where f.sic_id = s.id)
  ) then
    raise exception 'Hay montos en sics.final_amount sin fila en sic_finance: no se borra la columna';
  end if;
  if exists (select 1 from public.sics where estimated_amount is not null) then
    raise exception 'Hay valores en sics.estimated_amount: revisar antes de borrar la columna';
  end if;
end $$;

alter table public.sics drop column final_amount, drop column estimated_amount;
