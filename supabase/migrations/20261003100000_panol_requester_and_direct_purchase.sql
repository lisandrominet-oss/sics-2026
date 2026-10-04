-- (1) Pañol puede emitir SIC: sigue el mismo circuito que un operativo (pasa por el jefe de su área).
-- (2) Compra directa: Compras la clasifica y se saltea cotización y validación técnica; el monto es
--     obligatorio y, si supera el tope, igual pasa por Gerencia.

alter table sics drop constraint if exists sics_purchase_type_check;
alter table sics add constraint sics_purchase_type_check
  check (purchase_type in ('normal', 'cuenta_corriente', 'directa'));

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
  if v_role is null or v_role not in ('area','operativo','panol','gerencia','compras','admin') then
    raise exception 'Rol sin permiso para crear SIC';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

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

  -- Las SIC de un operativo o de Pañol pasan primero por el jefe de su área.
  if v_role in ('operativo', 'panol') then
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

-- ---------------------------------------------------------------- compra directa
create or replace function public.classify_sic_direct(p_sic_id uuid, p_amount numeric, p_provider_id uuid default null, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
  v_provider providers;
  v_new_status sic_status;
  v_threshold numeric;
  v_event_note text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede clasificar una SIC como compra directa';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto de la compra directa es obligatorio';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status not in ('enviada', 'cotizando') then
    raise exception 'Solo se puede clasificar una SIC enviada o en cotización';
  end if;

  if p_provider_id is not null then
    select * into v_provider from providers where id = p_provider_id;
    if v_provider is null then raise exception 'Proveedor no encontrado'; end if;
    if not v_provider.active then raise exception 'El proveedor está archivado'; end if;
  end if;

  -- Mismo criterio que la validación técnica: por encima del tope, decide Gerencia.
  if v_sic.currency = 'ARS' then
    select (value #>> '{}')::numeric into v_threshold from app_settings where key = 'gerencia_approval_threshold_ars';
    if p_amount > coalesce(v_threshold, 500000) then
      v_new_status := 'pendiente_aprobacion_gerencia';
    else
      v_new_status := 'aprobada';
    end if;
  else
    v_new_status := 'pendiente_aprobacion_gerencia';
  end if;

  update sics
  set purchase_type = 'directa', provider_id = p_provider_id, final_amount = p_amount,
      status = v_new_status, updated_at = now()
  where id = p_sic_id;

  v_event_note := 'Clasificada como compra directa. Monto: ' || p_amount::text
    || case when v_provider.name is not null then '. Proveedor: ' || v_provider.name else '' end
    || case when v_new_status = 'pendiente_aprobacion_gerencia' then '. Supera el tope: pasa a Gerencia' else '' end
    || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- Volver a compra normal (cuenta corriente o directa), solo antes de emitir la orden de compra.
create or replace function public.revert_sic_to_normal(p_sic_id uuid, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
  v_label text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede reclasificar una SIC';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.purchase_type not in ('cuenta_corriente', 'directa') or v_sic.status <> 'aprobada' then
    raise exception 'Solo se puede volver a compra normal antes de emitir la orden de compra';
  end if;

  v_label := case when v_sic.purchase_type = 'directa' then 'compra directa' else 'cuenta corriente' end;

  update sics
  set purchase_type = 'normal', provider_id = null,
      final_amount = case when v_sic.purchase_type = 'directa' then null else final_amount end,
      status = 'cotizando', updated_at = now()
  where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'cotizando',
    'Reclasificada como compra normal (era ' || v_label || ')'
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
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
        -- Pañol: órdenes que esperan recepción + lo suyo propio como solicitante.
        or (v_role = 'panol' and (
              s.status = 'orden_emitida'
              or (s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
            ))
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

revoke execute on function public.classify_sic_direct(uuid, numeric, uuid, text) from public;
revoke execute on function public.classify_sic_direct(uuid, numeric, uuid, text) from anon;
grant execute on function public.classify_sic_direct(uuid, numeric, uuid, text) to authenticated;
