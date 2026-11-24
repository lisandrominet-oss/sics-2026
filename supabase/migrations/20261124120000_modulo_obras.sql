-- Módulo Obras (Fase 1): el plan de la obra (WBS y actividades de Primavera) dentro de SICS, para clasificar
-- cada SIC en el ítem de obra al que corresponde. El circuito de la SIC no cambia: solo se suma
-- sics.project_node_id (opcional; nulo = "General del proyecto").
-- Importan y editan obras el admin y las áreas marcadas con plants.manages_obras (hoy, Ingeniería);
-- Gerencia y Compras las ven en solo lectura.

-- 1. Quién administra obras --------------------------------------------------------------------------------

alter table public.plants add column if not exists manages_obras boolean not null default false;
update public.plants set manages_obras = true where prefix = 'INGE';

-- Rol efectivo ("Ver como" incluido): el admin siempre; un jefe u operativo si su área administra obras.
create or replace function public.can_manage_obras()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select case
      when effective_role() = 'admin' then true
      when effective_role() in ('area', 'operativo') then exists (
        select 1 from plants pl where pl.id = p.plant_id and pl.manages_obras
      )
      else false
    end
    from profiles p
    where p.id = auth.uid() and p.active
  ), false);
$$;

create or replace function public.can_view_obras()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select can_manage_obras() or coalesce(effective_role() in ('gerencia', 'compras'), false);
$$;

-- Para el menú y las pantallas: 'editar', 'ver' o null.
create or replace function public.obras_access()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when can_manage_obras() then 'editar' when can_view_obras() then 'ver' else null end;
$$;

-- 2. Proyectos y plan de obra --------------------------------------------------------------------------------

alter table public.projects
  add column if not exists code text,
  add column if not exists source text not null default 'manual',
  add column if not exists imported_at timestamptz,
  add column if not exists imported_by uuid references public.profiles(id);

alter table public.projects drop constraint if exists projects_source_check;
alter table public.projects add constraint projects_source_check check (source in ('manual', 'primavera'));
create unique index if not exists projects_code_key on public.projects (lower(code)) where code is not null;

-- Árbol de la obra: nodos WBS y actividades, con la profundidad que traiga Primavera.
-- Las fechas pueden estar en cualquier nodo; en pantalla un WBS sin fechas propias muestra el rango de lo que cuelga de él.
create table if not exists public.project_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_nodes(id) on delete cascade,
  kind text not null check (kind in ('wbs', 'actividad')),
  external_id text not null,
  code text not null,
  name text not null,
  position int not null default 0,
  depth int not null default 0,
  active boolean not null default true,
  baseline_start date,
  baseline_end date,
  current_start date,
  current_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind, external_id),
  check (baseline_start is null or baseline_end is null or baseline_end >= baseline_start),
  check (current_start is null or current_end is null or current_end >= current_start),
  check (parent_id is null or parent_id <> id)
);
create index if not exists project_nodes_project_parent_idx on public.project_nodes (project_id, parent_id, position);

-- Historial de la obra: importación, plazos, nombres, altas y bajas.
create table if not exists public.project_node_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  node_id uuid references public.project_nodes(id) on delete cascade,
  change_type text not null check (change_type in ('importacion', 'plazo', 'corrimiento', 'nombre', 'alta', 'baja', 'reactivacion', 'plan_borrado')),
  origin text not null default 'manual' check (origin in ('manual', 'importacion', 'reimportacion')),
  old_start date,
  old_end date,
  new_start date,
  new_end date,
  detail text,
  reason text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists project_node_changes_project_idx on public.project_node_changes (project_id, created_at desc);
create index if not exists project_node_changes_node_idx on public.project_node_changes (node_id, created_at desc);

alter table public.project_nodes enable row level security;
alter table public.project_node_changes enable row level security;

-- La estructura la lee cualquier usuario con sesión (hace falta para elegir el ítem en la SIC). Nada se escribe directo.
drop policy if exists project_nodes_select_all on public.project_nodes;
create policy project_nodes_select_all on public.project_nodes for select to authenticated using (auth.uid() is not null);

drop policy if exists project_node_changes_select on public.project_node_changes;
create policy project_node_changes_select on public.project_node_changes for select to authenticated using (can_view_obras());

-- 3. Clasificación de la SIC ---------------------------------------------------------------------------------

alter table public.sics add column if not exists project_node_id uuid references public.project_nodes(id) on delete restrict;
create index if not exists sics_project_node_idx on public.sics (project_node_id) where project_node_id is not null;

-- Red de seguridad para cualquier camino que escriba sics:
--  * una SIC desprendida (artículos observados) hereda el ítem de obra de la SIC de origen;
--  * el ítem tiene que ser del mismo proyecto que la SIC.
create or replace function public.sics_project_node_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_node_project uuid;
begin
  if tg_op = 'INSERT' and new.parent_sic_id is not null and new.project_node_id is null then
    select s.project_node_id into new.project_node_id
    from sics s where s.id = new.parent_sic_id and s.project_id is not distinct from new.project_id;
  end if;

  if new.project_node_id is not null then
    select project_id into v_node_project from project_nodes where id = new.project_node_id;
    if new.project_id is null or v_node_project is distinct from new.project_id then
      raise exception 'El ítem de obra no corresponde al proyecto de la SIC';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sics_project_node_guard on public.sics;
create trigger sics_project_node_guard
  before insert or update of project_id, project_node_id on public.sics
  for each row execute function public.sics_project_node_guard();

-- Valida el ítem elegido para una SIC: del proyecto y activo.
create or replace function public.check_sic_project_node(p_project_id uuid, p_node_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_node_id is null then return; end if;
  if p_project_id is null then
    raise exception 'Para elegir un ítem de obra primero hay que elegir el proyecto';
  end if;
  if not exists (select 1 from project_nodes where id = p_node_id and project_id = p_project_id and active) then
    raise exception 'El ítem de obra no existe, no es de este proyecto o está dado de baja';
  end if;
end;
$$;

-- 4. create_sic y update_sic_details: solo se suma el ítem de obra (el resto es la definición vigente, sin cambios) --

drop function if exists public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text);

create or replace function public.create_sic(
  p_subject text,
  p_project_id uuid,
  p_needed_by_date date,
  p_currency currency_code default 'ARS'::currency_code,
  p_plant_id uuid default null::uuid,
  p_items jsonb default '[]'::jsonb,
  p_on_behalf_of text default null::text,
  p_project_node_id uuid default null::uuid
)
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
  if v_role is null or v_role not in ('area','operativo','gerencia','compras','admin') then
    raise exception 'Rol sin permiso para crear SIC';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

  perform check_sic_project_node(p_project_id, p_project_node_id);

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

  insert into sics (code, plant_id, year, sequence, requester_id, department, subject, project_id, needed_by_date, currency, status, on_behalf_of, project_node_id)
  values (v_code, v_plant_id, v_year, v_seq, v_profile.id, v_profile.department, p_subject, p_project_id, p_needed_by_date, p_currency, v_status, v_on_behalf_of, p_project_node_id)
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

grant execute on function public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text, uuid) to authenticated;

-- p_set_project_node: con false (el front anterior, que no conoce el campo) se conserva el ítem que tenía la SIC,
-- salvo que cambie el proyecto, en cuyo caso queda como "General".
drop function if exists public.update_sic_details(uuid, text, uuid, date, jsonb);

create or replace function public.update_sic_details(
  p_sic_id uuid,
  p_subject text,
  p_project_id uuid,
  p_needed_by_date date,
  p_items jsonb,
  p_project_node_id uuid default null::uuid,
  p_set_project_node boolean default false
)
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
  v_node uuid;
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

  if p_set_project_node then
    v_node := p_project_node_id;
    perform check_sic_project_node(p_project_id, v_node);
  elsif p_project_id is not distinct from v_sic.project_id then
    v_node := v_sic.project_node_id;
  else
    v_node := null;
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
    project_node_id = v_node,
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

grant execute on function public.update_sic_details(uuid, text, uuid, date, jsonb, uuid, boolean) to authenticated;

-- 5. Reclasificar una SIC ya enviada (no cambia el estado ni dispara avisos: no toca updated_at) ----------------

create or replace function public.sic_node_label(p_node_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((select code || ' ' || name from project_nodes where id = p_node_id), 'General del proyecto');
$$;

create or replace function public.set_sic_project_node(p_sic_id uuid, p_node_id uuid)
returns sics
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.project_id is null then raise exception 'La SIC no tiene proyecto'; end if;

  if not (
    v_role in ('compras', 'admin')
    or can_manage_obras()
    or (v_sic.requester_id = v_uid and v_sic.status in ('en_observacion', 'pendiente_aprobacion_jefe', 'enviada'))
  ) then
    raise exception 'No tenés permiso para cambiar el ítem de obra de esta SIC';
  end if;

  if v_sic.project_node_id is not distinct from p_node_id then
    return v_sic;
  end if;

  perform check_sic_project_node(v_sic.project_id, p_node_id);

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, v_sic.status,
          'Ítem de obra: ' || sic_node_label(v_sic.project_node_id) || ' → ' || sic_node_label(p_node_id));

  update sics set project_node_id = p_node_id where id = p_sic_id returning * into v_sic;
  return v_sic;
end;
$$;

grant execute on function public.set_sic_project_node(uuid, uuid) to authenticated;

-- 6. RPC del módulo Obras -------------------------------------------------------------------------------------

-- Importa el plan de una obra. Si p_project_id viene, el plan se carga en ese proyecto (que no tiene que tener plan);
-- si no, se crea el proyecto con p_project ({name, code}).
-- p_nodes: [{ref, parent_ref, kind, external_id, code, name, baseline_start, baseline_end, current_start, current_end}],
-- con cada padre antes que sus hijos. Sin línea base, la línea base es igual a la fecha vigente.
create or replace function public.obra_import(p_project_id uuid, p_project jsonb, p_nodes jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid := p_project_id;
  v_name text := nullif(trim(p_project->>'name'), '');
  v_code text := nullif(trim(p_project->>'code'), '');
  v_map jsonb := '{}'::jsonb;
  v_depths jsonb := '{}'::jsonb;
  v_node jsonb;
  v_ord bigint;
  v_parent uuid;
  v_depth int;
  v_id uuid;
  v_kind text;
  v_bs date; v_be date; v_cs date; v_ce date;
  v_n_wbs int := 0;
  v_n_act int := 0;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden importar obras'; end if;

  if jsonb_typeof(p_nodes) is distinct from 'array' or jsonb_array_length(p_nodes) < 1 then
    raise exception 'El plan no tiene ítems';
  end if;
  if jsonb_array_length(p_nodes) > 10000 then
    raise exception 'El plan tiene más de 10.000 ítems';
  end if;

  if v_project_id is null then
    if v_name is null then raise exception 'Falta el nombre del proyecto'; end if;
    if v_code is not null and exists (select 1 from projects where lower(code) = lower(v_code)) then
      raise exception 'Ya existe un proyecto con el código %', v_code;
    end if;
    insert into projects (name, code, active, source, imported_at, imported_by)
    values (v_name, v_code, true, 'primavera', now(), v_uid)
    returning id into v_project_id;
  else
    if not exists (select 1 from projects where id = v_project_id) then raise exception 'Proyecto no encontrado'; end if;
    if exists (select 1 from project_nodes where project_id = v_project_id) then
      raise exception 'Ese proyecto ya tiene un plan cargado: para actualizarlo usá "Actualizar desde Primavera"';
    end if;
    if v_code is not null and exists (select 1 from projects where lower(code) = lower(v_code) and id <> v_project_id) then
      raise exception 'Ya existe un proyecto con el código %', v_code;
    end if;
    update projects set
      code = coalesce(v_code, code),
      source = 'primavera',
      imported_at = now(),
      imported_by = v_uid
    where id = v_project_id;
  end if;

  for v_node, v_ord in select e, o from jsonb_array_elements(p_nodes) with ordinality as t(e, o) loop
    v_kind := v_node->>'kind';
    if v_kind not in ('wbs', 'actividad') then raise exception 'Fila %: tipo inválido', v_ord; end if;
    if nullif(trim(v_node->>'ref'), '') is null or nullif(trim(v_node->>'external_id'), '') is null then
      raise exception 'Fila %: falta el identificador', v_ord;
    end if;
    if nullif(trim(v_node->>'name'), '') is null then raise exception 'Fila %: falta el nombre', v_ord; end if;
    if v_map ? (v_node->>'ref') then raise exception 'Fila %: identificador repetido (%)', v_ord, v_node->>'ref'; end if;

    if nullif(v_node->>'parent_ref', '') is null then
      v_parent := null;
      v_depth := 0;
    else
      if not (v_map ? (v_node->>'parent_ref')) then
        raise exception 'Fila %: el padre % no aparece antes', v_ord, v_node->>'parent_ref';
      end if;
      v_parent := (v_map->>(v_node->>'parent_ref'))::uuid;
      v_depth := (v_depths->>(v_node->>'parent_ref'))::int + 1;
    end if;

    v_cs := nullif(v_node->>'current_start', '')::date;
    v_ce := nullif(v_node->>'current_end', '')::date;
    v_bs := coalesce(nullif(v_node->>'baseline_start', '')::date, v_cs);
    v_be := coalesce(nullif(v_node->>'baseline_end', '')::date, v_ce);

    insert into project_nodes (project_id, parent_id, kind, external_id, code, name, position, depth,
                               baseline_start, baseline_end, current_start, current_end)
    values (v_project_id, v_parent, v_kind, trim(v_node->>'external_id'),
            coalesce(nullif(trim(v_node->>'code'), ''), trim(v_node->>'external_id')),
            trim(v_node->>'name'), v_ord::int, v_depth, v_bs, v_be, v_cs, v_ce)
    returning id into v_id;

    v_map := v_map || jsonb_build_object(v_node->>'ref', v_id);
    v_depths := v_depths || jsonb_build_object(v_node->>'ref', v_depth);
    if v_kind = 'wbs' then v_n_wbs := v_n_wbs + 1; else v_n_act := v_n_act + 1; end if;
  end loop;

  insert into project_node_changes (project_id, change_type, origin, detail, actor_id)
  values (v_project_id, 'importacion', 'importacion',
          format('Plan importado desde Primavera: %s WBS y %s actividades', v_n_wbs, v_n_act), v_uid);

  return v_project_id;
end;
$$;

grant execute on function public.obra_import(uuid, jsonb, jsonb) to authenticated;

-- Quita el plan de un proyecto (para rehacer una importación equivocada). Solo si ninguna SIC usa sus ítems.
create or replace function public.obra_plan_delete(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if exists (select 1 from sics s join project_nodes n on n.id = s.project_node_id where n.project_id = p_project_id) then
    raise exception 'Hay SIC clasificadas en ítems de esta obra: no se puede borrar el plan. Dá de baja los ítems que no correspondan.';
  end if;
  delete from project_nodes where project_id = p_project_id;
  update projects set source = 'manual', imported_at = null, imported_by = null where id = p_project_id;
  insert into project_node_changes (project_id, change_type, origin, detail, actor_id)
  values (p_project_id, 'plan_borrado', 'manual', 'Se borró el plan de la obra', auth.uid());
end;
$$;

grant execute on function public.obra_plan_delete(uuid) to authenticated;

-- Datos del proyecto (nombre y código).
create or replace function public.obra_project_update(p_project_id uuid, p_name text, p_code text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_code text := nullif(trim(p_code), '');
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Falta el nombre del proyecto'; end if;
  if v_code is not null and exists (select 1 from projects where lower(code) = lower(v_code) and id <> p_project_id) then
    raise exception 'Ya existe un proyecto con el código %', v_code;
  end if;
  update projects set name = trim(p_name), code = v_code where id = p_project_id;
  if not found then raise exception 'Proyecto no encontrado'; end if;
end;
$$;

grant execute on function public.obra_project_update(uuid, text, text) to authenticated;

-- Agrega un ítem a mano (sin Primavera). Las fechas que se carguen son a la vez línea base y vigentes.
create or replace function public.obra_node_create(
  p_project_id uuid, p_parent_id uuid, p_kind text, p_code text, p_name text, p_start date, p_end date
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_depth int := 0;
  v_pos int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if p_kind not in ('wbs', 'actividad') then raise exception 'Tipo inválido'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then raise exception 'Faltan el código o el nombre'; end if;
  if p_start is not null and p_end is not null and p_end < p_start then raise exception 'El fin no puede ser anterior al inicio'; end if;
  if not exists (select 1 from projects where id = p_project_id) then raise exception 'Proyecto no encontrado'; end if;
  if p_parent_id is not null then
    select depth + 1 into v_depth from project_nodes where id = p_parent_id and project_id = p_project_id;
    if v_depth is null then raise exception 'El ítem padre no es de este proyecto'; end if;
  end if;

  select coalesce(max(position), 0) + 1 into v_pos from project_nodes where project_id = p_project_id;

  insert into project_nodes (project_id, parent_id, kind, external_id, code, name, position, depth,
                             baseline_start, baseline_end, current_start, current_end)
  values (p_project_id, p_parent_id, p_kind, 'manual-' || gen_random_uuid()::text, trim(p_code), trim(p_name),
          v_pos, v_depth, p_start, p_end, p_start, p_end)
  returning id into v_id;

  insert into project_node_changes (project_id, node_id, change_type, origin, new_start, new_end, detail, actor_id)
  values (p_project_id, v_id, 'alta', 'manual', p_start, p_end, 'Ítem agregado a mano: ' || trim(p_code) || ' ' || trim(p_name), auth.uid());
  return v_id;
end;
$$;

grant execute on function public.obra_node_create(uuid, uuid, text, text, text, date, date) to authenticated;

create or replace function public.obra_node_rename(p_node_id uuid, p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_node project_nodes;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then raise exception 'Faltan el código o el nombre'; end if;
  select * into v_node from project_nodes where id = p_node_id for update;
  if v_node.id is null then raise exception 'Ítem no encontrado'; end if;
  if v_node.code = trim(p_code) and v_node.name = trim(p_name) then return; end if;

  update project_nodes set code = trim(p_code), name = trim(p_name), updated_at = now() where id = p_node_id;
  insert into project_node_changes (project_id, node_id, change_type, origin, detail, actor_id)
  values (v_node.project_id, p_node_id, 'nombre', 'manual',
          v_node.code || ' ' || v_node.name || ' → ' || trim(p_code) || ' ' || trim(p_name), auth.uid());
end;
$$;

grant execute on function public.obra_node_rename(uuid, text, text) to authenticated;

-- Baja o alta de un ítem y de todo lo que cuelga de él. Un ítem dado de baja no se ofrece en la SIC,
-- pero las SIC que ya lo tienen lo conservan.
create or replace function public.obra_node_set_active(p_node_id uuid, p_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_node project_nodes;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indicá el motivo'; end if;
  select * into v_node from project_nodes where id = p_node_id for update;
  if v_node.id is null then raise exception 'Ítem no encontrado'; end if;
  if v_node.active = p_active then return; end if;

  with recursive sub as (
    select id from project_nodes where id = p_node_id
    union all
    select n.id from project_nodes n join sub on n.parent_id = sub.id
  )
  update project_nodes set active = p_active, updated_at = now() where id in (select id from sub);

  insert into project_node_changes (project_id, node_id, change_type, origin, detail, reason, actor_id)
  values (v_node.project_id, p_node_id, case when p_active then 'reactivacion' else 'baja' end, 'manual',
          v_node.code || ' ' || v_node.name, trim(p_reason), auth.uid());
end;
$$;

grant execute on function public.obra_node_set_active(uuid, boolean, text) to authenticated;

-- Cambia los plazos vigentes de un ítem. La línea base no se toca (salvo que el ítem no tuviera fechas: ahí se fija).
create or replace function public.obra_node_reschedule(p_node_id uuid, p_start date, p_end date, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_node project_nodes;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indicá el motivo del cambio de plazo'; end if;
  if p_start is null or p_end is null then raise exception 'Indicá inicio y fin'; end if;
  if p_end < p_start then raise exception 'El fin no puede ser anterior al inicio'; end if;

  select * into v_node from project_nodes where id = p_node_id for update;
  if v_node.id is null then raise exception 'Ítem no encontrado'; end if;
  if v_node.current_start is not distinct from p_start and v_node.current_end is not distinct from p_end then return; end if;

  update project_nodes set
    current_start = p_start,
    current_end = p_end,
    baseline_start = coalesce(baseline_start, p_start),
    baseline_end = coalesce(baseline_end, p_end),
    updated_at = now()
  where id = p_node_id;

  insert into project_node_changes (project_id, node_id, change_type, origin, old_start, old_end, new_start, new_end, reason, actor_id)
  values (v_node.project_id, p_node_id, 'plazo', 'manual', v_node.current_start, v_node.current_end, p_start, p_end, trim(p_reason), auth.uid());
end;
$$;

grant execute on function public.obra_node_reschedule(uuid, date, date, text) to authenticated;

-- Corre N días (atraso con positivo, adelanto con negativo) un ítem y todo lo que cuelga de él.
create or replace function public.obra_node_shift(p_node_id uuid, p_days int, p_reason text)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_node project_nodes;
  v_count int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden modificar obras'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indicá el motivo del corrimiento'; end if;
  if p_days is null or p_days = 0 then raise exception 'Indicá cuántos días'; end if;
  if abs(p_days) > 3650 then raise exception 'El corrimiento no puede superar los 10 años'; end if;

  select * into v_node from project_nodes where id = p_node_id;
  if v_node.id is null then raise exception 'Ítem no encontrado'; end if;

  with recursive sub as (
    select id from project_nodes where id = p_node_id
    union all
    select n.id from project_nodes n join sub on n.parent_id = sub.id
  ),
  moved as (
    update project_nodes n set
      current_start = n.current_start + p_days,
      current_end = n.current_end + p_days,
      updated_at = now()
    from sub
    where n.id = sub.id and (n.current_start is not null or n.current_end is not null)
    returning n.id, n.current_start, n.current_end
  )
  insert into project_node_changes (project_id, node_id, change_type, origin, old_start, old_end, new_start, new_end, detail, reason, actor_id)
  select v_node.project_id, m.id, 'corrimiento', 'manual', m.current_start - p_days, m.current_end - p_days, m.current_start, m.current_end,
         case when m.id = p_node_id then null else 'Corrido junto con ' || v_node.code end,
         trim(p_reason), auth.uid()
  from moved m;

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'Ni el ítem ni lo que cuelga de él tienen fechas para correr'; end if;

  return v_count;
end;
$$;

grant execute on function public.obra_node_shift(uuid, int, text) to authenticated;

grant execute on function public.can_manage_obras() to authenticated;
grant execute on function public.can_view_obras() to authenticated;
grant execute on function public.obras_access() to authenticated;
