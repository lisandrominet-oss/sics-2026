-- Revisión por ítem (jefe de área y Compras): aprobar, observar o rechazar cada artículo.
-- Los observados salen a una SIC nueva vinculada (parent_sic_id); los rechazados quedan en la
-- original, marcados y excluidos de recepción y certificados. La corrección modifica los ítems
-- en el lugar (conserva archivos de referencia).

alter table public.sic_items
  add column if not exists review_status text not null default 'activo',
  add column if not exists review_note text;

alter table public.sic_items
  drop constraint if exists sic_items_review_status_check;
alter table public.sic_items
  add constraint sic_items_review_status_check check (review_status in ('activo', 'rechazado'));

alter table public.sics
  add column if not exists parent_sic_id uuid references public.sics(id) on delete set null;

create index if not exists sics_parent_sic_id_idx on public.sics(parent_sic_id);

-- ---------------------------------------------------------------------------
-- review_sic_items: decisión por ítem (stage jefe: pendiente_aprobacion_jefe; stage Compras: enviada)
-- p_decisions: [{ "item_id": uuid, "decision": "aceptar|observar|rechazar", "note": text }]
-- ---------------------------------------------------------------------------
create or replace function public.review_sic_items(
  p_sic_id uuid,
  p_decisions jsonb,
  p_note text default null
)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_child sics;
  v_stage text;
  v_label text;
  v_adv_status sic_status;
  v_rej_status sic_status;
  v_new_status sic_status;
  v_n_active int;
  v_n_dec int;
  v_n_missing int;
  v_n_acc int;
  v_n_obs int;
  v_n_rej int;
  v_year int := extract(year from now())::int;
  v_seq int;
  v_prefix text;
  v_code text;
  v_obs_text text;
  v_rej_text text;
  v_event_note text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;

  if v_sic.status = 'pendiente_aprobacion_jefe' then
    v_stage := 'jefe';
    v_label := 'jefe de área';
    v_adv_status := 'enviada';
    v_rej_status := 'rechazada_jefe';
    if v_role <> 'admin' then
      if v_role <> 'area' or not exists (
        select 1 from profiles p where p.id = v_uid and p.active and p.plant_id = v_sic.plant_id
      ) then
        raise exception 'Solo un jefe del área de la SIC puede revisarla';
      end if;
    end if;
  elsif v_sic.status = 'enviada' then
    v_stage := 'compras';
    v_label := 'Compras';
    v_adv_status := 'cotizando';
    v_rej_status := 'rechazada_compras';
    if v_role not in ('compras', 'admin') then
      raise exception 'Solo Compras puede revisar la SIC';
    end if;
  else
    raise exception 'La SIC no está pendiente de revisión';
  end if;

  if jsonb_typeof(p_decisions) is distinct from 'array' then
    raise exception 'Decisiones inválidas';
  end if;

  select count(*) into v_n_active from sic_items where sic_id = p_sic_id and review_status = 'activo';
  select count(*) into v_n_dec from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text);
  select count(*) into v_n_missing
  from sic_items i
  where i.sic_id = p_sic_id and i.review_status = 'activo'
    and not exists (
      select 1 from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
      where d.item_id = i.id
    );
  if v_n_dec <> v_n_active or v_n_missing > 0 then
    raise exception 'Debe decidir sobre todos los artículos de la SIC';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
    where d.decision is null or d.decision not in ('aceptar', 'observar', 'rechazar')
  ) then
    raise exception 'Decisión inválida';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
    where d.decision in ('observar', 'rechazar') and (d.note is null or btrim(d.note) = '')
  ) then
    raise exception 'Debe indicar el motivo de cada artículo observado o rechazado';
  end if;

  select
    count(*) filter (where d.decision = 'aceptar'),
    count(*) filter (where d.decision = 'observar'),
    count(*) filter (where d.decision = 'rechazar')
  into v_n_acc, v_n_obs, v_n_rej
  from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text);

  select string_agg('«' || i.description || '»: ' || btrim(d.note), '; ' order by i.position)
  into v_obs_text
  from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
  join sic_items i on i.id = d.item_id
  where d.decision = 'observar';

  select string_agg('«' || i.description || '»: ' || btrim(d.note), '; ' order by i.position)
  into v_rej_text
  from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
  join sic_items i on i.id = d.item_id
  where d.decision = 'rechazar';

  if v_n_acc = 0 and v_n_obs = 0 then
    v_new_status := v_rej_status;
  elsif v_n_acc = 0 then
    v_new_status := 'en_observacion';
  else
    v_new_status := v_adv_status;
  end if;

  -- Marcas por ítem
  update sic_items i
  set review_status = 'rechazado', review_note = btrim(d.note)
  from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
  where d.item_id = i.id and d.decision = 'rechazar';

  update sic_items i
  set review_note = btrim(d.note)
  from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
  where d.item_id = i.id and d.decision = 'observar';

  -- Desprendimiento: los observados pasan a una SIC nueva
  if v_n_acc > 0 and v_n_obs > 0 then
    select prefix into v_prefix from plants where id = v_sic.plant_id;

    insert into sic_counters (plant_id, year, last_seq) values (v_sic.plant_id, v_year, 1)
    on conflict (plant_id, year) do update set last_seq = sic_counters.last_seq + 1
    returning last_seq into v_seq;

    v_code := 'SIC-' || v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

    insert into sics (code, plant_id, year, sequence, requester_id, department, subject, project_id,
                      needed_by_date, currency, status, on_behalf_of, parent_sic_id)
    values (v_code, v_sic.plant_id, v_year, v_seq, v_sic.requester_id, v_sic.department, v_sic.subject,
            v_sic.project_id, v_sic.needed_by_date, v_sic.currency, 'en_observacion', v_sic.on_behalf_of, v_sic.id)
    returning * into v_child;

    update sic_items i
    set sic_id = v_child.id, position = r.rn::int
    from (
      select i2.id, row_number() over (order by i2.position) as rn
      from sic_items i2
      join jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text) on d.item_id = i2.id
      where d.decision = 'observar'
    ) r
    where i.id = r.id;

    update sic_files
    set sic_id = v_child.id
    where item_id in (
      select d.item_id from jsonb_to_recordset(p_decisions) as d(item_id uuid, decision text, note text)
      where d.decision = 'observar'
    );

    insert into sic_events (sic_id, actor_id, from_status, to_status, note)
    values (
      v_child.id, v_uid, null, 'en_observacion',
      'Desprendida de ' || v_sic.code || ' en la revisión por artículo (' || v_label || '). Artículos observados — ' || v_obs_text
    );
  end if;

  -- Reordenar la SIC original: activos primero, rechazados al final
  update sic_items i
  set position = r.rn::int
  from (
    select id, row_number() over (order by (review_status = 'rechazado'), position) as rn
    from sic_items where sic_id = p_sic_id
  ) r
  where i.id = r.id;

  update sics set status = v_new_status, updated_at = now() where id = p_sic_id;

  v_event_note := 'Revisión por artículo (' || v_label || '): '
    || v_n_acc || ' aprobado(s), ' || v_n_obs || ' observado(s), ' || v_n_rej || ' rechazado(s).';
  if v_child.id is not null then
    v_event_note := v_event_note || ' Los observados pasaron a ' || v_child.code || ' (' || v_obs_text || ').';
  elsif v_n_obs > 0 then
    v_event_note := v_event_note || ' Observados — ' || v_obs_text || '.';
  end if;
  if v_rej_text is not null then
    v_event_note := v_event_note || ' Rechazados — ' || v_rej_text || '.';
  end if;
  if p_note is not null and btrim(p_note) <> '' then
    v_event_note := v_event_note || ' ' || btrim(p_note);
  end if;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

revoke all on function public.review_sic_items(uuid, jsonb, text) from public;
revoke all on function public.review_sic_items(uuid, jsonb, text) from anon;
grant execute on function public.review_sic_items(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_sic_details: modifica los ítems en el lugar (conserva id y archivos de referencia).
-- Cada elemento de p_items puede traer "id"; los que no traen id se insertan; los ítems activos
-- que no vienen en el payload se eliminan. Los ítems rechazados no se tocan.
-- ---------------------------------------------------------------------------
create or replace function public.update_sic_details(
  p_sic_id uuid,
  p_subject text,
  p_project_id uuid,
  p_needed_by_date date,
  p_items jsonb
)
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
  v_n_active int;
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

  -- Quitados por el solicitante
  delete from sic_items i
  where i.sic_id = p_sic_id and i.review_status = 'activo'
    and not exists (
      select 1 from jsonb_array_elements(p_items) e where nullif(e->>'id', '')::uuid = i.id
    );

  -- Existentes: se modifican en el lugar
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

  -- Nuevos
  insert into sic_items (sic_id, position, description, quantity, specs, reference_link, requires_quality_cert)
  select p_sic_id, ord::int, item->>'description', (item->>'quantity')::numeric,
         nullif(item->>'specs', ''), nullif(item->>'reference_link', ''),
         coalesce((item->>'requires_quality_cert')::boolean, false)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  where nullif(item->>'id', '') is null;

  -- Rechazados al final
  select count(*) into v_n_active from sic_items where sic_id = p_sic_id and review_status = 'activo';
  update sic_items i
  set position = v_n_active + r.rn::int
  from (
    select id, row_number() over (order by position) as rn
    from sic_items where sic_id = p_sic_id and review_status = 'rechazado'
  ) r
  where i.id = r.id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, 'en_observacion', v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recepción: los ítems rechazados no cuentan
-- ---------------------------------------------------------------------------
create or replace function public.record_delivery(p_sic_id uuid, p_deliveries jsonb, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
  v_item jsonb;
  v_all_complete boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('panol','admin') then
    raise exception 'Solo Pañol puede registrar la recepción';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'orden_emitida' then
    raise exception 'La SIC no está en estado "orden emitida"';
  end if;
  if not exists (select 1 from sic_files where sic_id = p_sic_id and file_type = 'remito') then
    raise exception 'Debe subir al menos un remito antes de registrar la recepción';
  end if;

  for v_item in select * from jsonb_array_elements(p_deliveries)
  loop
    update sic_items
    set received_quantity = least(quantity, received_quantity + (v_item->>'quantity_received')::numeric)
    where id = (v_item->>'item_id')::uuid and sic_id = p_sic_id and review_status = 'activo';
  end loop;

  select bool_and(received_quantity >= quantity) into v_all_complete
  from sic_items where sic_id = p_sic_id and review_status = 'activo';

  if v_all_complete then
    update sics set status = 'recibida', updated_at = now() where id = p_sic_id;
    insert into sic_events (sic_id, actor_id, from_status, to_status, note)
    values (p_sic_id, auth.uid(), 'orden_emitida', 'recibida', coalesce(p_note, 'Recepción completa'));
  else
    update sics set updated_at = now() where id = p_sic_id;
    insert into sic_events (sic_id, actor_id, from_status, to_status, note)
    values (p_sic_id, auth.uid(), 'orden_emitida', 'orden_emitida', coalesce(p_note, 'Recepción parcial registrada'));
  end if;

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $$;

-- ---------------------------------------------------------------------------
-- Certificados pendientes: solo ítems activos
-- ---------------------------------------------------------------------------
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
  if v_role is null or v_role not in ('compras','admin') then
    return;
  end if;

  return query
    select s.id, s.code, s.subject, s.status, s.updated_at, i.id, i.description
    from sics s
    join sic_items i on i.sic_id = s.id
    where i.requires_quality_cert
      and i.review_status = 'activo'
      and not exists (
        select 1 from sic_files f
        where f.item_id = i.id and f.file_type = 'certificado_calidad'
      )
    order by s.updated_at desc;
end;
$$;
