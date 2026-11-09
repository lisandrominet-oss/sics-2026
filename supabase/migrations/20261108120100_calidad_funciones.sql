-- Módulo "Calidad · Avance de obra" (Fase A): funciones. ADITIVA (solo funciones cal_* nuevas).
-- Todas SECURITY DEFINER, mensajes en español, auditoría en cal_events.
-- Roles internos: admin (admin de SICS), supervisor (cal_staff) y consulta (solo mira).

-- ---------------------------------------------------------------- rol interno del usuario actual
-- Con "Ver como" (acting_as_role) el admin pasa a ver lo que vería ese rol: solo consulta.
create or replace function public.cal_role()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p profiles;
  v_r text;
begin
  if auth.uid() is null then return null; end if;
  if not has_module('calidad', true) then return null; end if;
  select * into v_p from profiles where id = auth.uid() and active;
  if v_p.id is null then return null; end if;
  if v_p.role = 'admin' then
    if v_p.acting_as_role is not null then return 'consulta'; end if;
    return 'admin';
  end if;
  select role into v_r from cal_staff where user_id = auth.uid() and active;
  return coalesce(v_r, 'consulta');
end;
$function$;
revoke all on function public.cal_role() from public, anon;
grant execute on function public.cal_role() to authenticated;

-- ---------------------------------------------------------------- helpers internos (sin acceso directo)
create or replace function public.cal_require(p_roles text[])
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := cal_role();
  if v_role is null then raise exception 'Sin permiso para usar Calidad'; end if;
  if not (v_role = any (p_roles)) then
    raise exception 'Tu rol en Calidad (%) no puede hacer esta acción', v_role;
  end if;
  return v_role;
end;
$function$;

create or replace function public.cal_actor_name()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(nullif(btrim(full_name), ''), email) from profiles where id = auth.uid();
$function$;

create or replace function public.cal_log(
  p_entity text, p_id uuid, p_project uuid, p_type text, p_note text default null, p_data jsonb default null)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  insert into cal_events (entity, entity_id, project_id, event_type, actor_id, actor_name, note, data)
  values (p_entity, p_id, p_project, p_type, auth.uid(), cal_actor_name(), p_note, p_data);
$function$;

-- Texto limpio: vacío = null.
create or replace function public.cal_txt(p_text text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select nullif(btrim(coalesce(p_text, '')), '');
$function$;

-- Hoy en Argentina (la base corre en UTC: pasadas las 21 h ya sería "mañana").
create or replace function public.cal_today()
returns date
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$function$;

-- Fecha de "completado" de un elemento: el día en que la etapa final llegó al total; se limpia si baja.
create or replace function public.cal_recalc_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_item cal_items;
  v_final uuid;
  v_q int;
begin
  select * into v_item from cal_items where id = p_item_id;
  if v_item.id is null then return; end if;
  select id into v_final from cal_stages where group_id = v_item.group_id order by position desc limit 1;
  select qty into v_q from cal_counts where item_id = p_item_id and stage_id = v_final;
  if v_item.total > 0 and coalesce(v_q, 0) >= v_item.total then
    update cal_items set completed_at = coalesce(completed_at, cal_today()) where id = p_item_id;
  else
    update cal_items set completed_at = null where id = p_item_id and completed_at is not null;
  end if;
end;
$function$;

revoke all on function public.cal_require(text[]) from public, anon, authenticated;
revoke all on function public.cal_actor_name() from public, anon, authenticated;
revoke all on function public.cal_log(text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.cal_txt(text) from public, anon, authenticated;
revoke all on function public.cal_today() from public, anon, authenticated;
revoke all on function public.cal_recalc_item(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- proyectos
create or replace function public.cal_save_project(p_id uuid, p_code text, p_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text := cal_txt(p_code);
  v_name text := cal_txt(p_name);
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_code is null then raise exception 'El código del proyecto es obligatorio'; end if;
  if v_name is null then raise exception 'El nombre del proyecto es obligatorio'; end if;
  if exists (select 1 from cal_projects where lower(code) = lower(v_code) and id is distinct from p_id) then
    raise exception 'Ya existe un proyecto con el código %', v_code;
  end if;
  if p_id is null then
    insert into cal_projects (code, name, created_by) values (v_code, v_name, auth.uid()) returning id into v_id;
    perform cal_log('project', v_id, v_id, 'proyecto_creado', null, jsonb_build_object('code', v_code, 'name', v_name));
  else
    update cal_projects set code = v_code, name = v_name, updated_at = now() where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Proyecto inexistente'; end if;
    perform cal_log('project', v_id, v_id, 'proyecto_editado', null, jsonb_build_object('code', v_code, 'name', v_name));
  end if;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------- sectores (bahías)
create or replace function public.cal_save_bay(
  p_id uuid, p_project_id uuid, p_name text, p_responsible text, p_due_date date, p_position int default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := cal_txt(p_name);
  v_project uuid;
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_name is null then raise exception 'El nombre del sector es obligatorio'; end if;
  if p_id is null then
    if not exists (select 1 from cal_projects where id = p_project_id and active) then
      raise exception 'Proyecto inexistente o archivado';
    end if;
    v_project := p_project_id;
  else
    select project_id into v_project from cal_bays where id = p_id for update;
    if v_project is null then raise exception 'Sector inexistente'; end if;
  end if;
  if exists (
    select 1 from cal_bays
     where project_id = v_project and active and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Ya hay un sector llamado "%" en este proyecto', v_name;
  end if;
  if p_id is null then
    insert into cal_bays (project_id, name, position, responsible, due_date)
    values (v_project, v_name,
            coalesce(p_position, (select coalesce(max(position), 0) + 1 from cal_bays where project_id = v_project)),
            cal_txt(p_responsible), p_due_date)
    returning id into v_id;
    perform cal_log('bay', v_id, v_project, 'sector_creado', null, jsonb_build_object('name', v_name));
  else
    update cal_bays
       set name = v_name, responsible = cal_txt(p_responsible), due_date = p_due_date,
           position = coalesce(p_position, position), updated_at = now()
     where id = p_id returning id into v_id;
    perform cal_log('bay', v_id, v_project, 'sector_editado', null,
                    jsonb_build_object('name', v_name, 'responsible', cal_txt(p_responsible), 'due_date', p_due_date));
  end if;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------- grupos (copian las etapas de una plantilla)
create or replace function public.cal_save_group(
  p_id uuid, p_bay_id uuid, p_name text, p_template_id uuid default null, p_position int default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := cal_txt(p_name);
  v_bay uuid;
  v_project uuid;
  v_tpl cal_templates;
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_name is null then raise exception 'El nombre del grupo es obligatorio'; end if;
  if p_id is null then
    select b.id, b.project_id into v_bay, v_project from cal_bays b where b.id = p_bay_id and b.active;
    if v_bay is null then raise exception 'Sector inexistente o archivado'; end if;
    select * into v_tpl from cal_templates where id = p_template_id and active;
    if v_tpl.id is null then raise exception 'Elegí una plantilla de etapas'; end if;
  else
    select g.bay_id, b.project_id into v_bay, v_project
      from cal_groups g join cal_bays b on b.id = g.bay_id where g.id = p_id for update of g;
    if v_bay is null then raise exception 'Grupo inexistente'; end if;
  end if;
  if exists (
    select 1 from cal_groups
     where bay_id = v_bay and active and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Ya hay un grupo llamado "%" en este sector', v_name;
  end if;
  if p_id is null then
    insert into cal_groups (bay_id, name, position)
    values (v_bay, v_name, coalesce(p_position, (select coalesce(max(position), 0) + 1 from cal_groups where bay_id = v_bay)))
    returning id into v_id;
    insert into cal_stages (group_id, position, name)
    select v_id, (s.ord - 1)::int, s.val from jsonb_array_elements_text(v_tpl.stages) with ordinality as s(val, ord);
    perform cal_log('group', v_id, v_project, 'grupo_creado', null,
                    jsonb_build_object('name', v_name, 'plantilla', v_tpl.name));
  else
    update cal_groups set name = v_name, position = coalesce(p_position, position), updated_at = now()
     where id = p_id returning id into v_id;
    perform cal_log('group', v_id, v_project, 'grupo_editado', null, jsonb_build_object('name', v_name));
  end if;
  return v_id;
end;
$function$;

-- Etapas de un grupo: p_stages = [{"id": uuid|null, "name": "..."}, …] en el orden deseado.
-- Las que no están en la lista se borran (con sus cantidades). La última es la etapa final.
create or replace function public.cal_save_group_stages(p_group_id uuid, p_stages jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project uuid;
  v_el jsonb;
  v_ord int := 0;
  v_name text;
  v_sid uuid;
  v_keep uuid[] := '{}';
  v_names text[] := '{}';
  v_lost int;
  v_item uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  select b.project_id into v_project
    from cal_groups g join cal_bays b on b.id = g.bay_id where g.id = p_group_id for update of g;
  if v_project is null then raise exception 'Grupo inexistente'; end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' or jsonb_array_length(p_stages) not between 1 and 20 then
    raise exception 'Un grupo necesita entre 1 y 20 etapas';
  end if;

  -- validar todo antes de tocar nada
  for v_el in select * from jsonb_array_elements(p_stages) loop
    v_name := cal_txt(v_el ->> 'name');
    if v_name is null then raise exception 'Hay una etapa sin nombre'; end if;
    if lower(v_name) = any (v_names) then raise exception 'La etapa "%" está repetida', v_name; end if;
    v_names := v_names || lower(v_name);
    if nullif(v_el ->> 'id', '') is not null then
      v_sid := (v_el ->> 'id')::uuid;
      if not exists (select 1 from cal_stages where id = v_sid and group_id = p_group_id) then
        raise exception 'Una etapa no pertenece a este grupo';
      end if;
      if v_sid = any (v_keep) then raise exception 'Una etapa está duplicada en la lista'; end if;
      v_keep := v_keep || v_sid;
    end if;
  end loop;

  select count(*) into v_lost
    from cal_counts c join cal_stages s on s.id = c.stage_id
   where s.group_id = p_group_id and s.id <> all (v_keep) and c.qty > 0;
  delete from cal_stages where group_id = p_group_id and id <> all (v_keep);

  for v_el in select * from jsonb_array_elements(p_stages) loop
    v_name := cal_txt(v_el ->> 'name');
    if nullif(v_el ->> 'id', '') is not null then
      update cal_stages set name = v_name, position = v_ord where id = (v_el ->> 'id')::uuid;
    else
      insert into cal_stages (group_id, position, name) values (p_group_id, v_ord, v_name);
    end if;
    v_ord := v_ord + 1;
  end loop;

  -- la etapa final pudo cambiar: recalcular las fechas de completado
  for v_item in select id from cal_items where group_id = p_group_id loop
    perform cal_recalc_item(v_item);
  end loop;
  update cal_groups set updated_at = now() where id = p_group_id;
  perform cal_log('group', p_group_id, v_project, 'etapas_editadas', null,
                  jsonb_build_object('etapas', (select jsonb_agg(e ->> 'name') from jsonb_array_elements(p_stages) e),
                                     'cantidades_perdidas', v_lost));
end;
$function$;

-- ---------------------------------------------------------------- elementos
create or replace function public.cal_save_item(
  p_id uuid, p_group_id uuid, p_name text, p_total int, p_due_date date, p_position int default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := cal_txt(p_name);
  v_group uuid;
  v_project uuid;
  v_max int;
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_name is null then raise exception 'El nombre del elemento es obligatorio'; end if;
  if p_total is null or p_total < 0 then raise exception 'El total no puede ser negativo'; end if;
  if p_id is null then
    select g.id, b.project_id into v_group, v_project
      from cal_groups g join cal_bays b on b.id = g.bay_id where g.id = p_group_id and g.active;
    if v_group is null then raise exception 'Grupo inexistente o archivado'; end if;
  else
    select i.group_id, b.project_id into v_group, v_project
      from cal_items i join cal_groups g on g.id = i.group_id join cal_bays b on b.id = g.bay_id
     where i.id = p_id for update of i;
    if v_group is null then raise exception 'Elemento inexistente'; end if;
    select coalesce(max(qty), 0) into v_max from cal_counts where item_id = p_id;
    if p_total < v_max then
      raise exception 'Hay etapas con % unidades: bajá primero esas cantidades antes de reducir el total a %', v_max, p_total;
    end if;
  end if;
  if exists (
    select 1 from cal_items
     where group_id = v_group and active and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'Ya hay un elemento llamado "%" en este grupo', v_name;
  end if;
  if p_id is null then
    insert into cal_items (group_id, name, position, total, due_date)
    values (v_group, v_name,
            coalesce(p_position, (select coalesce(max(position), 0) + 1 from cal_items where group_id = v_group)),
            p_total, p_due_date)
    returning id into v_id;
    perform cal_log('item', v_id, v_project, 'elemento_creado', null, jsonb_build_object('name', v_name, 'total', p_total));
  else
    update cal_items
       set name = v_name, total = p_total, due_date = p_due_date, position = coalesce(p_position, position), updated_at = now()
     where id = p_id returning id into v_id;
    perform cal_recalc_item(v_id);
    perform cal_log('item', v_id, v_project, 'elemento_editado', null,
                    jsonb_build_object('name', v_name, 'total', p_total, 'due_date', p_due_date));
  end if;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------- carga de avance (la de la reunión)
-- p_changes = [{"item_id": uuid, "stage_id": uuid, "qty": int}, …]. Todo o nada; registra solo lo que cambió.
create or replace function public.cal_save_counts(p_group_id uuid, p_changes jsonb)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project uuid;
  v_group_active boolean;
  v_ch jsonb;
  v_item cal_items;
  v_stage_name text;
  v_item_id uuid;
  v_stage_id uuid;
  v_qty int;
  v_old int;
  v_diff jsonb := '[]'::jsonb;
  v_touched uuid[] := '{}';
  v_n int := 0;
  v_i uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  select b.project_id, g.active into v_project, v_group_active
    from cal_groups g join cal_bays b on b.id = g.bay_id where g.id = p_group_id for update of g;
  if v_project is null then raise exception 'Grupo inexistente'; end if;
  if not v_group_active then raise exception 'El grupo está archivado'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then raise exception 'Formato de cambios inválido'; end if;
  if jsonb_array_length(p_changes) > 2000 then raise exception 'Demasiados cambios juntos'; end if;

  perform 1 from cal_items where group_id = p_group_id order by id for update;

  for v_ch in select * from jsonb_array_elements(p_changes) loop
    if (v_ch ->> 'qty') is null or (v_ch ->> 'qty') !~ '^[0-9]{1,9}$' then
      raise exception 'Cantidad inválida: usá números enteros de 0 en adelante';
    end if;
    if (v_ch ->> 'item_id') is null or (v_ch ->> 'stage_id') is null then
      raise exception 'Falta el elemento o la etapa';
    end if;
    v_item_id := (v_ch ->> 'item_id')::uuid;
    v_stage_id := (v_ch ->> 'stage_id')::uuid;
    v_qty := (v_ch ->> 'qty')::int;

    select * into v_item from cal_items where id = v_item_id and group_id = p_group_id and active;
    if v_item.id is null then raise exception 'Un elemento no existe, está archivado o es de otro grupo'; end if;
    select name into v_stage_name from cal_stages where id = v_stage_id and group_id = p_group_id;
    if v_stage_name is null then raise exception 'Una etapa no pertenece a este grupo'; end if;
    if v_qty > v_item.total then
      raise exception '"%" en "%": % supera el total (%)', v_item.name, v_stage_name, v_qty, v_item.total;
    end if;

    select qty into v_old from cal_counts where item_id = v_item_id and stage_id = v_stage_id;
    v_old := coalesce(v_old, 0);
    if v_qty <> v_old then
      insert into cal_counts (item_id, stage_id, qty) values (v_item_id, v_stage_id, v_qty)
      on conflict (item_id, stage_id) do update set qty = excluded.qty, updated_at = now();
      v_diff := v_diff || jsonb_build_object('item', v_item.name, 'etapa', v_stage_name, 'de', v_old, 'a', v_qty);
      if not (v_item_id = any (v_touched)) then v_touched := v_touched || v_item_id; end if;
      v_n := v_n + 1;
    end if;
  end loop;

  if v_n = 0 then return 0; end if;
  foreach v_i in array v_touched loop
    perform cal_recalc_item(v_i);
  end loop;
  update cal_groups
     set progress_at = now(), progress_by_name = cal_actor_name(), updated_at = now()
   where id = p_group_id;
  perform cal_log('group', p_group_id, v_project, 'avance', null, jsonb_build_object('cambios', v_diff));
  return v_n;
end;
$function$;

-- ---------------------------------------------------------------- archivar / reactivar
create or replace function public.cal_set_active(p_entity text, p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project uuid;
  v_found uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if p_active is null then raise exception 'Falta indicar si se archiva o se reactiva'; end if;
  if p_entity = 'project' then
    update cal_projects set active = p_active, updated_at = now() where id = p_id returning id into v_found;
    v_project := v_found;
  elsif p_entity = 'bay' then
    update cal_bays set active = p_active, updated_at = now() where id = p_id returning project_id into v_project;
    v_found := v_project;
  elsif p_entity = 'group' then
    update cal_groups g set active = p_active, updated_at = now()
      from cal_bays b where g.id = p_id and b.id = g.bay_id returning b.project_id into v_project;
    v_found := v_project;
  elsif p_entity = 'item' then
    update cal_items i set active = p_active, updated_at = now()
      from cal_groups g, cal_bays b where i.id = p_id and g.id = i.group_id and b.id = g.bay_id
      returning b.project_id into v_project;
    v_found := v_project;
  else
    raise exception 'Tipo inválido';
  end if;
  if v_found is null then raise exception 'No se encontró lo que querés archivar'; end if;
  perform cal_log(p_entity, p_id, v_project, case when p_active then 'reactivado' else 'archivado' end);
end;
$function$;

-- ---------------------------------------------------------------- plantillas de etapas
-- p_stages = ["Armado", "Soldado", …]
create or replace function public.cal_save_template(p_id uuid, p_name text, p_stages jsonb, p_active boolean default true)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := cal_txt(p_name);
  v_el text;
  v_names text[] := '{}';
  v_clean jsonb := '[]'::jsonb;
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_name is null then raise exception 'El nombre de la plantilla es obligatorio'; end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' or jsonb_array_length(p_stages) not between 1 and 20 then
    raise exception 'Una plantilla necesita entre 1 y 20 etapas';
  end if;
  for v_el in select jsonb_array_elements_text(p_stages) loop
    v_el := cal_txt(v_el);
    if v_el is null then raise exception 'Hay una etapa sin nombre'; end if;
    if lower(v_el) = any (v_names) then raise exception 'La etapa "%" está repetida', v_el; end if;
    v_names := v_names || lower(v_el);
    v_clean := v_clean || to_jsonb(v_el);
  end loop;
  if exists (select 1 from cal_templates where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Ya existe una plantilla llamada "%"', v_name;
  end if;
  if p_id is null then
    insert into cal_templates (name, stages, active) values (v_name, v_clean, coalesce(p_active, true)) returning id into v_id;
  else
    update cal_templates set name = v_name, stages = v_clean, active = coalesce(p_active, true), updated_at = now()
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Plantilla inexistente'; end if;
  end if;
  perform cal_log('template', v_id, null, case when p_id is null then 'plantilla_creada' else 'plantilla_editada' end,
                  null, jsonb_build_object('name', v_name, 'etapas', v_clean));
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------- novedades (diario)
create or replace function public.cal_add_note(p_bay_id uuid, p_group_id uuid, p_note_date date, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_body text := cal_txt(p_body);
  v_project uuid;
  v_id uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  if v_body is null then raise exception 'Escribí la novedad'; end if;
  if char_length(v_body) > 2000 then raise exception 'La novedad es demasiado larga (máximo 2000 caracteres)'; end if;
  select project_id into v_project from cal_bays where id = p_bay_id and active;
  if v_project is null then raise exception 'Sector inexistente o archivado'; end if;
  if p_group_id is not null and not exists (select 1 from cal_groups where id = p_group_id and bay_id = p_bay_id) then
    raise exception 'El grupo no es de ese sector';
  end if;
  insert into cal_notes (bay_id, group_id, note_date, body, created_by, created_by_name)
  values (p_bay_id, p_group_id, coalesce(p_note_date, cal_today()), v_body, auth.uid(), cal_actor_name())
  returning id into v_id;
  perform cal_log('note', v_id, v_project, 'novedad', v_body);
  return v_id;
end;
$function$;

create or replace function public.cal_delete_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_note cal_notes;
  v_project uuid;
begin
  perform cal_require(array['admin', 'supervisor']);
  select * into v_note from cal_notes where id = p_note_id for update;
  if v_note.id is null then raise exception 'Novedad inexistente'; end if;
  select project_id into v_project from cal_bays where id = v_note.bay_id;
  delete from cal_notes where id = p_note_id;
  perform cal_log('note', p_note_id, v_project, 'novedad_borrada', v_note.body,
                  jsonb_build_object('fecha', v_note.note_date, 'autor', v_note.created_by_name));
end;
$function$;

-- ---------------------------------------------------------------- supervisores (solo admin)
create or replace function public.cal_set_staff(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p profiles;
begin
  perform cal_require(array['admin']);
  if p_active is null then raise exception 'Falta indicar si se habilita o se quita'; end if;
  select * into v_p from profiles where id = p_user_id and active;
  if v_p.id is null then raise exception 'Usuario inexistente o inactivo'; end if;
  insert into cal_staff (user_id, role, active) values (p_user_id, 'supervisor', p_active)
  on conflict (user_id) do update set active = excluded.active, updated_at = now();
  perform cal_log('staff', p_user_id, null, case when p_active then 'supervisor_alta' else 'supervisor_baja' end,
                  null, jsonb_build_object('email', v_p.email));
end;
$function$;

-- ---------------------------------------------------------------- permisos de ejecución
do $$
declare
  f text;
begin
  foreach f in array array[
    'cal_save_project(uuid, text, text)',
    'cal_save_bay(uuid, uuid, text, text, date, int)',
    'cal_save_group(uuid, uuid, text, uuid, int)',
    'cal_save_group_stages(uuid, jsonb)',
    'cal_save_item(uuid, uuid, text, int, date, int)',
    'cal_save_counts(uuid, jsonb)',
    'cal_set_active(text, uuid, boolean)',
    'cal_save_template(uuid, text, jsonb, boolean)',
    'cal_add_note(uuid, uuid, date, text)',
    'cal_delete_note(uuid)',
    'cal_set_staff(uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
