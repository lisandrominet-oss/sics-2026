-- Rol Operativo + filtro del jefe de área + visibilidad por área + anulación por quien emitió.
-- Además corrige: (1) el rol "área" no podía subir archivos de referencia (la policy de
-- storage.objects solo admitía admin/compras/pañol) y (2) las cotizaciones ya no son obligatorias.

-- ---------------------------------------------------------------- helpers
create or replace function public.my_plant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select plant_id from profiles where id = auth.uid() and active;
$$;

-- ¿El usuario es jefe u operativo de esa área (planta)? Se usa en las policies de lectura.
create or replace function public.is_area_member_of_plant(p_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    p_plant_id is not null
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.active and p.role in ('area', 'operativo') and p.plant_id = p_plant_id
    ),
    false
  );
$$;

revoke execute on function public.my_plant_id() from public;
revoke execute on function public.my_plant_id() from anon;
grant execute on function public.my_plant_id() to authenticated;
revoke execute on function public.is_area_member_of_plant(uuid) from public;
revoke execute on function public.is_area_member_of_plant(uuid) from anon;
grant execute on function public.is_area_member_of_plant(uuid) to authenticated;

-- ---------------------------------------------------------------- policies de lectura por área
drop policy if exists sics_select_area on sics;
create policy sics_select_area on sics for select to authenticated
  using (is_area_member_of_plant(plant_id));

drop policy if exists sic_items_select_area on sic_items;
create policy sic_items_select_area on sic_items for select to authenticated
  using (exists (select 1 from sics s where s.id = sic_items.sic_id and is_area_member_of_plant(s.plant_id)));

drop policy if exists sic_files_select_area on sic_files;
create policy sic_files_select_area on sic_files for select to authenticated
  using (exists (select 1 from sics s where s.id = sic_files.sic_id and is_area_member_of_plant(s.plant_id)));

drop policy if exists sic_events_select_area on sic_events;
create policy sic_events_select_area on sic_events for select to authenticated
  using (exists (select 1 from sics s where s.id = sic_events.sic_id and is_area_member_of_plant(s.plant_id)));

-- Nombres: compañeros del área y quienes actuaron en SIC que el usuario puede ver.
drop policy if exists profiles_select_same_plant on profiles;
create policy profiles_select_same_plant on profiles for select to authenticated
  using (is_area_member_of_plant(plant_id));

drop policy if exists profiles_select_sic_actors on profiles;
create policy profiles_select_sic_actors on profiles for select to authenticated
  using (
    my_role() in ('area', 'operativo')
    and exists (select 1 from sic_events e where e.actor_id = profiles.id)
  );

-- ---------------------------------------------------------------- storage (sic-files)
drop policy if exists sic_files_storage_insert on storage.objects;
create policy sic_files_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sic-files'
    and (
      my_role() in ('admin', 'compras', 'panol')
      or (
        my_role() in ('area', 'operativo')
        and (storage.foldername(name))[2] = 'referencia'
        and exists (
          select 1 from sics s
          where s.requester_id = auth.uid() and s.id::text = (storage.foldername(name))[1]
        )
      )
    )
  );

drop policy if exists sic_files_storage_select on storage.objects;
create policy sic_files_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'sic-files'
    and (
      my_role() in ('admin', 'compras', 'gerencia', 'panol')
      or exists (
        select 1 from sics s
        where s.id::text = (storage.foldername(name))[1]
          and (s.requester_id = auth.uid() or is_area_member_of_plant(s.plant_id))
      )
    )
  );

-- ---------------------------------------------------------------- create_sic
create or replace function public.create_sic(
  p_subject text, p_project_id uuid, p_needed_by_date date,
  p_currency currency_code default 'ARS', p_plant_id uuid default null,
  p_items jsonb default '[]'::jsonb, p_on_behalf_of text default null
)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile profiles;
  v_role user_role;
  v_plant_id uuid;
  v_on_behalf_of text;
  v_year int := extract(year from now())::int;
  v_seq int;
  v_prefix text;
  v_code text;
  v_status sic_status;
  v_note text;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or not v_profile.active then
    raise exception 'Usuario no habilitado';
  end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('area','operativo','gerencia','compras','admin') then
    raise exception 'Rol sin permiso para crear SIC';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

  -- Solo compras/admin pueden emitir una SIC en nombre de otra área o persona.
  if v_role in ('compras', 'admin') then
    v_plant_id := coalesce(p_plant_id, v_profile.plant_id);
    v_on_behalf_of := nullif(trim(p_on_behalf_of), '');
  else
    v_plant_id := v_profile.plant_id;
    v_on_behalf_of := null;
  end if;

  if v_plant_id is null then
    raise exception 'Debe indicar la planta de la SIC';
  end if;

  select prefix into v_prefix from plants where id = v_plant_id and active;
  if v_prefix is null then
    raise exception 'Planta inválida o inactiva';
  end if;

  -- Las SIC de un operativo pasan primero por el jefe de su área.
  if v_role = 'operativo' then
    if not exists (select 1 from profiles where role = 'area' and active and plant_id = v_plant_id) then
      raise exception 'Tu área no tiene un jefe asignado. Avisá a un administrador.';
    end if;
    v_status := 'pendiente_aprobacion_jefe';
    v_note := 'SIC creada. Pendiente de aprobación del jefe de área';
  else
    v_status := 'enviada';
    v_note := 'SIC creada';
  end if;

  insert into sic_counters (plant_id, year, last_seq) values (v_plant_id, v_year, 1)
  on conflict (plant_id, year) do update set last_seq = sic_counters.last_seq + 1
  returning last_seq into v_seq;

  v_code := 'SIC-' || v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into sics (code, plant_id, year, sequence, requester_id, department, subject, project_id, needed_by_date, currency, status, on_behalf_of)
  values (v_code, v_plant_id, v_year, v_seq, v_profile.id, v_profile.department, p_subject, p_project_id, p_needed_by_date, p_currency, v_status, v_on_behalf_of)
  returning * into v_sic;

  insert into sic_items (sic_id, position, description, quantity, specs, reference_link, requires_quality_cert)
  select v_sic.id, ord::int, item->>'description', (item->>'quantity')::numeric, nullif(item->>'specs',''), nullif(item->>'reference_link',''), coalesce((item->>'requires_quality_cert')::boolean, false)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord);

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (v_sic.id, v_profile.id, null, v_status, v_note);

  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- aprobación del jefe
create or replace function public.jefe_review_sic(p_sic_id uuid, p_decision compras_decision, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_new_status sic_status;
  v_event_note text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'pendiente_aprobacion_jefe' then
    raise exception 'La SIC no está pendiente de aprobación del jefe';
  end if;

  if v_role <> 'admin' then
    if v_role <> 'area' or not exists (
      select 1 from profiles p where p.id = v_uid and p.active and p.plant_id = v_sic.plant_id
    ) then
      raise exception 'Solo un jefe del área de la SIC puede aprobarla';
    end if;
  end if;

  if p_decision in ('rechazar', 'observar') and (p_note is null or btrim(p_note) = '') then
    raise exception 'Debe indicar el motivo';
  end if;

  if p_decision = 'aceptar' then
    v_new_status := 'enviada';
    v_event_note := 'Aprobada por el jefe de área' || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end;
  elsif p_decision = 'rechazar' then
    v_new_status := 'rechazada_jefe';
    v_event_note := p_note;
  else
    v_new_status := 'en_observacion';
    v_event_note := p_note;
  end if;

  update sics set status = v_new_status, updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- reenvío tras corrección
create or replace function public.update_sic_details(p_sic_id uuid, p_subject text, p_project_id uuid, p_needed_by_date date, p_items jsonb)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_requester_role user_role;
  v_new_status sic_status;
  v_event_note text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'en_observacion' then
    raise exception 'La SIC no está en observación';
  end if;
  if v_role <> 'admin' and v_sic.requester_id is distinct from v_uid then
    raise exception 'Solo el solicitante original puede editar esta SIC';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

  -- Si la emitió un operativo, el reenvío vuelve a pasar por el jefe de área.
  select role into v_requester_role from profiles where id = v_sic.requester_id;
  if v_requester_role = 'operativo' then
    if not exists (select 1 from profiles where role = 'area' and active and plant_id = v_sic.plant_id) then
      raise exception 'El área de la SIC no tiene un jefe asignado. Avisá a un administrador.';
    end if;
    v_new_status := 'pendiente_aprobacion_jefe';
    v_event_note := 'Corregida y reenviada al jefe de área';
  else
    v_new_status := 'enviada';
    v_event_note := 'Corregida y reenviada a Compras';
  end if;

  update sics set
    subject = p_subject,
    project_id = p_project_id,
    needed_by_date = p_needed_by_date,
    status = v_new_status,
    updated_at = now()
  where id = p_sic_id;

  delete from sic_items where sic_id = p_sic_id;

  insert into sic_items (sic_id, position, description, quantity, specs, reference_link, requires_quality_cert)
  select p_sic_id, ord::int, item->>'description', (item->>'quantity')::numeric, nullif(item->>'specs',''), nullif(item->>'reference_link',''), coalesce((item->>'requires_quality_cert')::boolean, false)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord);

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, 'en_observacion', v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- validación técnica
create or replace function public.technical_review(p_sic_id uuid, p_aprobar boolean, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_new_status sic_status;
  v_threshold numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'pendiente_validacion_tecnica' then
    raise exception 'La SIC no está pendiente de validación técnica';
  end if;
  -- Pueden validar: quien emitió la SIC, un jefe de su área, o admin.
  if v_role <> 'admin' and v_sic.requester_id is distinct from v_uid then
    if v_role <> 'area' or not exists (
      select 1 from profiles p where p.id = v_uid and p.active and p.plant_id = v_sic.plant_id
    ) then
      raise exception 'Solo quien emitió la SIC o un jefe de su área puede validarla técnicamente';
    end if;
  end if;

  if not p_aprobar then
    v_new_status := 'cotizando';
  else
    if v_sic.currency = 'ARS' then
      select (value #>> '{}')::numeric into v_threshold from app_settings where key = 'gerencia_approval_threshold_ars';
      if v_sic.final_amount is not null and v_sic.final_amount > coalesce(v_threshold, 500000) then
        v_new_status := 'pendiente_aprobacion_gerencia';
      else
        v_new_status := 'aprobada';
      end if;
    else
      v_new_status := 'pendiente_aprobacion_gerencia';
    end if;
  end if;

  update sics set status = v_new_status, updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, v_new_status, p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- cotizaciones no obligatorias
create or replace function public.submit_quotes(p_sic_id uuid, p_final_amount numeric, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede enviar las cotizaciones';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'cotizando' then
    raise exception 'La SIC no está en estado "cotizando"';
  end if;

  update sics set final_amount = p_final_amount, status = 'pendiente_validacion_tecnica', updated_at = now()
  where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, 'pendiente_validacion_tecnica', p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- anulación
-- Compras/admin: en cualquier estado no terminal. Quien emitió la SIC: antes de que Compras la acepte.
create or replace function public.cancel_sic(p_sic_id uuid, p_note text)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Tenés que indicar el motivo de la anulación';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status in ('cerrada', 'anulada') then
    raise exception 'Esta SIC ya está % y no se puede anular', v_sic.status;
  end if;

  if v_role not in ('compras', 'admin') then
    if v_sic.requester_id is distinct from v_uid then
      raise exception 'Solo quien emitió la SIC puede anularla';
    end if;
    if v_sic.status not in ('pendiente_aprobacion_jefe', 'en_observacion', 'enviada') then
      raise exception 'Compras ya tomó esta SIC. Pedile a Compras que la anule.';
    end if;
  end if;

  update sics set status = 'anulada', updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, 'anulada', p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------- archivos de referencia
create or replace function public.delete_sic_file(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_file sic_files;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_file from sic_files where id = p_file_id;
  if v_file is null then raise exception 'Archivo no encontrado'; end if;

  select * into v_sic from sics where id = v_file.sic_id;

  if v_file.file_type in ('cotizacion','comparacion') then
    if v_role not in ('compras','admin') or v_sic.status <> 'cotizando' then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'orden_compra' then
    if v_role not in ('compras','admin') or v_sic.status <> 'aprobada' then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'remito' then
    if v_role not in ('panol','admin') or v_sic.status <> 'orden_emitida' then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'factura' then
    if v_sic.status = 'orden_emitida' then
      if v_role not in ('panol','admin') then
        raise exception 'No se puede eliminar este archivo en el estado actual';
      end if;
    elsif v_sic.status = 'recibida' then
      if v_role not in ('compras','admin') then
        raise exception 'No se puede eliminar este archivo en el estado actual';
      end if;
    else
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'referencia' then
    if v_role <> 'admin' and (v_sic.requester_id is distinct from auth.uid() or v_sic.status not in ('enviada','en_observacion','pendiente_aprobacion_jefe')) then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  else
    if v_role <> 'admin' then raise exception 'No tenés permiso para eliminar este archivo'; end if;
  end if;

  delete from sic_files where id = p_file_id;
end;
$$;

-- ---------------------------------------------------------------- notificaciones
create or replace function public.get_pending_notifications(p_limit integer default 20)
returns table(id uuid, code text, subject text, status sic_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
        (v_role = 'compras' and s.status = any(array['enviada','cotizando','aprobada','recibida']::sic_status[]))
        or (v_role = 'gerencia' and s.status = 'pendiente_aprobacion_gerencia')
        or (v_role = 'panol' and s.status = 'orden_emitida')
        -- Jefe: lo que espera su aprobación (de toda el área) y lo suyo propio.
        or (v_role = 'area' and (
              (s.status = 'pendiente_aprobacion_jefe' and s.plant_id = v_plant)
              or (s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
            ))
        or (v_role = 'operativo' and s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
      )
    order by s.updated_at desc
    limit p_limit;
end;
$$;

-- ---------------------------------------------------------------- permisos de ejecución
revoke execute on function public.jefe_review_sic(uuid, compras_decision, text) from public;
revoke execute on function public.jefe_review_sic(uuid, compras_decision, text) from anon;
grant execute on function public.jefe_review_sic(uuid, compras_decision, text) to authenticated;
