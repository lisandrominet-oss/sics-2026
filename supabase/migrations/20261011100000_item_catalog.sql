-- Catálogo de artículos (consumibles de uso frecuente) para autocompletar en la SIC.
-- Sin FK desde sic_items: la SIC sigue guardando el texto en sic_items.description.
-- El catálogo crece solo al crear / reenviar una SIC (ver catalog_register).

-- Normalización para detectar duplicados: minúsculas, sin acentos, espacios colapsados.
create or replace function public.catalog_norm(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(
    translate(trim(p_text), 'áéíóúüñÁÉÍÓÚÜÑàèìòùâêîôû', 'aeiouunAEIOUUNaeiouaeiou'),
    '\s+', ' ', 'g'))
$$;

create table public.item_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  name_norm text generated always as (public.catalog_norm(name)) stored,
  active boolean not null default true,
  uses_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index item_catalog_name_norm_key on public.item_catalog (name_norm);
create index item_catalog_active_uses_idx on public.item_catalog (active, uses_count desc);

alter table public.item_catalog enable row level security;

create policy item_catalog_select_all on public.item_catalog
  for select using (auth.uid() is not null);

create policy item_catalog_staff_write on public.item_catalog
  for all
  using (public.my_role() in ('admin', 'compras'))
  with check (public.my_role() in ('admin', 'compras'));

-- Alta automática (uso interno, solo desde otras funciones SECURITY DEFINER).
-- p_count = true suma un uso; false solo agrega los nombres que no existían.
-- Un artículo desactivado NO se reactiva solo.
create or replace function public.catalog_register(p_names text[], p_count boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into item_catalog (name, uses_count, last_used_at, created_by)
  select distinct on (public.catalog_norm(n))
         left(regexp_replace(trim(n), '\s+', ' ', 'g'), 200), 1, now(), auth.uid()
  from unnest(p_names) as n
  where nullif(trim(n), '') is not null
  order by public.catalog_norm(n)
  on conflict (name_norm) do update
    set uses_count = item_catalog.uses_count + case when p_count then 1 else 0 end,
        last_used_at = case when p_count then now() else item_catalog.last_used_at end;
end;
$$;

revoke execute on function public.catalog_register(text[], boolean) from public, anon, authenticated;

-- Administración (Compras y admin; respeta "Ver como" vía effective_role()).
create or replace function public.catalog_save(p_id uuid, p_name text)
returns item_catalog
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 200);
  v_row item_catalog;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if effective_role() is null or effective_role() not in ('compras', 'admin') then
    raise exception 'Solo Compras o Administración pueden editar el catálogo';
  end if;
  if v_name = '' then raise exception 'Indicá el nombre del artículo'; end if;

  if p_id is null then
    insert into item_catalog (name, created_by) values (v_name, auth.uid())
    returning * into v_row;
  else
    update item_catalog set name = v_name where id = p_id returning * into v_row;
    if v_row is null then raise exception 'Artículo no encontrado'; end if;
  end if;
  return v_row;
exception when unique_violation then
  raise exception 'Ya existe un artículo igual en el catálogo';
end;
$$;

create or replace function public.catalog_set_active(p_id uuid, p_active boolean)
returns item_catalog
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row item_catalog;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if effective_role() is null or effective_role() not in ('compras', 'admin') then
    raise exception 'Solo Compras o Administración pueden editar el catálogo';
  end if;
  update item_catalog set active = coalesce(p_active, true) where id = p_id returning * into v_row;
  if v_row is null then raise exception 'Artículo no encontrado'; end if;
  return v_row;
end;
$$;

revoke execute on function public.catalog_save(uuid, text), public.catalog_set_active(uuid, boolean) from public, anon;
grant execute on function public.catalog_save(uuid, text), public.catalog_set_active(uuid, boolean) to authenticated;

-- create_sic: igual que la versión vigente + alta en el catálogo (cuenta un uso).
create or replace function public.create_sic(p_subject text, p_project_id uuid, p_needed_by_date date, p_currency currency_code default 'ARS'::currency_code, p_plant_id uuid default null::uuid, p_items jsonb default '[]'::jsonb, p_on_behalf_of text default null::text)
returns sics
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  perform catalog_register(array(select e->>'description' from jsonb_array_elements(p_items) e), true);

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (v_sic.id, v_profile.id, null, v_status, v_note);

  return v_sic;
end;
$function$;

-- update_sic_details: igual que la versión vigente + alta de artículos nuevos
-- en el catálogo (sin sumar usos: es un reenvío de la misma SIC).
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
  values (p_sic_id, v_uid, 'en_observacion', v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;

-- Carga inicial desde lo ya pedido (se calcula al aplicar; no hay datos en el repo).
insert into item_catalog (name, uses_count, last_used_at)
select distinct on (public.catalog_norm(description))
       left(regexp_replace(trim(description), '\s+', ' ', 'g'), 200),
       count(*) over (partition by public.catalog_norm(description))::int,
       max(created_at) over (partition by public.catalog_norm(description))
from sic_items
where nullif(trim(description), '') is not null
order by public.catalog_norm(description), created_at desc;
