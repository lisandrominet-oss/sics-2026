-- Compras también recibe: toda SIC con orden emitida (bienes o servicios) es un pendiente de Compras.
-- Antes solo veía los servicios; si Pañol no recibía un bien, Compras no se enteraba.
-- Único cambio respecto de 20261012100000: la rama de Compras ya no filtra por is_service.

create or replace function public.get_pending_notifications(p_limit integer default 20)
returns table(id uuid, code text, subject text, status sic_status, updated_at timestamp with time zone)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_plant uuid;
begin
  if v_uid is null then
    return;
  end if;

  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'gerencia', 'panol', 'area', 'operativo') then
    return;
  end if;
  select p.plant_id into v_plant from profiles p where p.id = v_uid;

  return query
    select s.id, s.code, s.subject, s.status, s.updated_at
    from sics s
    left join notification_reads r on r.sic_id = s.id and r.profile_id = v_uid
    where (r.read_at is null or r.read_at < s.updated_at)
      and (
        (v_role = 'compras' and s.status = any(array['enviada','cotizando','aprobada','orden_emitida','recibida']::sic_status[]))
        or (v_role = 'gerencia' and s.status = 'pendiente_aprobacion_gerencia')
        or (v_role = 'panol' and s.status = 'orden_emitida' and not s.is_service)
        or (v_role = 'area' and (
              (s.status = 'pendiente_aprobacion_jefe' and s.plant_id = v_plant)
              or (s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
            ))
        or (v_role = 'operativo' and s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
      )
    order by s.updated_at desc
    limit p_limit;
end;
$function$;
