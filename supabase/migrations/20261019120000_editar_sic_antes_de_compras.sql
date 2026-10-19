-- El solicitante (o admin) puede editar la SIC mientras Compras no la haya tomado:
-- en pendiente_aprobacion_jefe y enviada la edición NO cambia el estado (el jefe no vuelve a aprobar),
-- pero deja evento en el recorrido y sube updated_at para que los avisos reaparezcan.
-- en_observacion se comporta igual que antes (corregir y reenviar).
create or replace function public.update_sic_details(p_sic_id uuid, p_subject text, p_project_id uuid, p_needed_by_date date, p_items jsonb)
returns sics
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_requester_role user_role;
  v_old_status sic_status;
  v_new_status sic_status;
  v_event_note text;
  v_n_active int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status not in ('en_observacion', 'pendiente_aprobacion_jefe', 'enviada') then
    raise exception 'Compras ya tomó esta SIC: no se puede editar';
  end if;
  if v_role <> 'admin' and v_sic.requester_id is distinct from v_uid then
    raise exception 'Solo el solicitante original puede editar esta SIC';
  end if;
  v_old_status := v_sic.status;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where nullif(e->>'id', '') is not null
      and not exists (
        select 1 from sic_items i
        where i.id = (e->>'id')::uuid and i.sic_id = p_sic_id and i.review_status = 'activo'
      )
  ) then
    raise exception 'Artículo inválido';
  end if;

  if v_old_status = 'en_observacion' then
    select role into v_requester_role from profiles where id = v_sic.requester_id;
    if v_requester_role in ('operativo', 'panol') then
      if not exists (select 1 from profiles where role = 'area' and active and plant_id = v_sic.plant_id) then
        raise exception 'El área de la SIC no tiene un jefe asignado. Avisá a un administrador.';
      end if;
      v_new_status := 'pendiente_aprobacion_jefe';
      v_event_note := 'Corregida y reenviada al jefe de área';
    else
      v_new_status := 'enviada';
      v_event_note := 'Corregida y reenviada a Compras';
    end if;
  else
    v_new_status := v_old_status;
    v_event_note := 'Editada por el solicitante';
  end if;

  update sics set
    subject = p_subject,
    project_id = p_project_id,
    needed_by_date = p_needed_by_date,
    status = v_new_status,
    updated_at = now()
  where id = p_sic_id;

  delete from sic_items i
  where i.sic_id = p_sic_id and i.review_status = 'activo'
    and not exists (
      select 1 from jsonb_array_elements(p_items) e where nullif(e->>'id', '')::uuid = i.id
    );

  update sic_items i
  set description = e.item->>'description',
      quantity = (e.item->>'quantity')::numeric,
      specs = nullif(e.item->>'specs', ''),
      reference_link = nullif(e.item->>'reference_link', ''),
      requires_quality_cert = coalesce((e.item->>'requires_quality_cert')::boolean, false),
      position = e.ord::int,
      review_note = null
  from (
    select item, ord from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  ) e
  where i.sic_id = p_sic_id and i.review_status = 'activo'
    and i.id = nullif(e.item->>'id', '')::uuid;

  insert into sic_items (sic_id, position, description, quantity, specs, reference_link, requires_quality_cert)
  select p_sic_id, ord::int, item->>'description', (item->>'quantity')::numeric,
         nullif(item->>'specs', ''), nullif(item->>'reference_link', ''),
         coalesce((item->>'requires_quality_cert')::boolean, false)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  where nullif(item->>'id', '') is null;

  perform catalog_register(array(select e->>'description' from jsonb_array_elements(p_items) e), false);

  select count(*) into v_n_active from sic_items where sic_id = p_sic_id and review_status = 'activo';
  update sic_items i
  set position = v_n_active + r.rn::int
  from (
    select id, row_number() over (order by position) as rn
    from sic_items where sic_id = p_sic_id and review_status = 'rechazado'
  ) r
  where i.id = r.id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_old_status, v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;
