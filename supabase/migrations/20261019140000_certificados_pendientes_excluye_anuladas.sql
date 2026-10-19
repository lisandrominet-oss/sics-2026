-- Certificados pendientes: no contar SIC que ya no avanzan (anuladas o rechazadas).
-- Antes solo se miraba el ítem, y anular una SIC no cambia el review_status de sus ítems.
-- Las cerradas se mantienen: el certificado se puede subir aunque la SIC ya esté cerrada.
create or replace function public.get_pending_quality_certificates()
returns table(sic_id uuid, code text, subject text, status sic_status, updated_at timestamptz, item_id uuid, item_description text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
begin
  if v_uid is null then
    return;
  end if;

  v_role := effective_role();
  if not has_module('certificados', true) then
    return;
  end if;

  return query
    select s.id, s.code, s.subject, s.status, s.updated_at, i.id, i.description
    from sics s
    join sic_items i on i.sic_id = s.id
    where i.requires_quality_cert
      and i.review_status = 'activo'
      and s.status not in ('anulada', 'rechazada_jefe', 'rechazada_compras', 'rechazada_gerencia')
      and not exists (
        select 1 from sic_files f
        where f.item_id = i.id and f.file_type = 'certificado_calidad'
      )
    order by s.updated_at desc;
end;
$$;
