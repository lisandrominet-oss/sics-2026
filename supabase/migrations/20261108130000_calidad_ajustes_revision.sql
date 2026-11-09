-- Calidad: ajustes tras la revisión independiente. Solo toca funciones cal_* y una policy propia.
-- 1) No se crea ni se carga avance bajo algo archivado (se mira toda la cadena: grupo, sector y proyecto).
-- 2) Reactivar exige que el padre esté activo y que el nombre no esté ocupado por un hermano activo.
-- 3) Los eventos de supervisores (llevan correos) los ve solo el admin.

drop policy if exists cal_events_select on public.cal_events;
create policy cal_events_select on public.cal_events
  for select to authenticated
  using ((select has_module('calidad')) and (entity <> 'staff' or (select cal_role()) = 'admin'));

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
    select b.id, b.project_id into v_bay, v_project
      from cal_bays b join cal_projects p on p.id = b.project_id
     where b.id = p_bay_id and b.active and p.active;
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
      from cal_groups g join cal_bays b on b.id = g.bay_id join cal_projects p on p.id = b.project_id
     where g.id = p_group_id and g.active and b.active and p.active;
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

create or replace function public.cal_save_counts(p_group_id uuid, p_changes jsonb)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project uuid;
  v_all_active boolean;
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
  select b.project_id, (g.active and b.active and p.active) into v_project, v_all_active
    from cal_groups g join cal_bays b on b.id = g.bay_id join cal_projects p on p.id = b.project_id
   where g.id = p_group_id for update of g;
  if v_project is null then raise exception 'Grupo inexistente'; end if;
  if not v_all_active then raise exception 'El grupo, su sector o su proyecto están archivados'; end if;
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

-- Archivar es siempre posible; reactivar pide padre activo y nombre libre entre los hermanos activos.
create or replace function public.cal_set_active(p_entity text, p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_project uuid;
  v_parent uuid;
  v_name text;
begin
  perform cal_require(array['admin', 'supervisor']);
  if p_active is null then raise exception 'Falta indicar si se archiva o se reactiva'; end if;

  if p_entity = 'project' then
    update cal_projects set active = p_active, updated_at = now() where id = p_id returning id into v_project;

  elsif p_entity = 'bay' then
    select project_id, name into v_project, v_name from cal_bays where id = p_id for update;
    if v_project is null then raise exception 'No se encontró lo que querés archivar'; end if;
    if p_active then
      if not exists (select 1 from cal_projects where id = v_project and active) then
        raise exception 'Reactivá primero el proyecto';
      end if;
      if exists (select 1 from cal_bays where project_id = v_project and active and lower(name) = lower(v_name) and id <> p_id) then
        raise exception 'Ya hay un sector llamado "%": renombrá uno de los dos antes de reactivar', v_name;
      end if;
    end if;
    update cal_bays set active = p_active, updated_at = now() where id = p_id;

  elsif p_entity = 'group' then
    select g.bay_id, b.project_id, g.name into v_parent, v_project, v_name
      from cal_groups g join cal_bays b on b.id = g.bay_id where g.id = p_id for update of g;
    if v_project is null then raise exception 'No se encontró lo que querés archivar'; end if;
    if p_active then
      if not exists (select 1 from cal_bays b join cal_projects p on p.id = b.project_id where b.id = v_parent and b.active and p.active) then
        raise exception 'Reactivá primero el sector';
      end if;
      if exists (select 1 from cal_groups where bay_id = v_parent and active and lower(name) = lower(v_name) and id <> p_id) then
        raise exception 'Ya hay un grupo llamado "%": renombrá uno de los dos antes de reactivar', v_name;
      end if;
    end if;
    update cal_groups set active = p_active, updated_at = now() where id = p_id;

  elsif p_entity = 'item' then
    select i.group_id, b.project_id, i.name into v_parent, v_project, v_name
      from cal_items i join cal_groups g on g.id = i.group_id join cal_bays b on b.id = g.bay_id where i.id = p_id for update of i;
    if v_project is null then raise exception 'No se encontró lo que querés archivar'; end if;
    if p_active then
      if not exists (
        select 1 from cal_groups g join cal_bays b on b.id = g.bay_id join cal_projects p on p.id = b.project_id
         where g.id = v_parent and g.active and b.active and p.active
      ) then
        raise exception 'Reactivá primero el grupo';
      end if;
      if exists (select 1 from cal_items where group_id = v_parent and active and lower(name) = lower(v_name) and id <> p_id) then
        raise exception 'Ya hay un elemento llamado "%": renombrá uno de los dos antes de reactivar', v_name;
      end if;
    end if;
    update cal_items set active = p_active, updated_at = now() where id = p_id;

  else
    raise exception 'Tipo inválido';
  end if;

  if v_project is null then raise exception 'No se encontró lo que querés archivar'; end if;
  perform cal_log(p_entity, p_id, v_project, case when p_active then 'reactivado' else 'archivado' end);
end;
$function$;

revoke all on function public.cal_save_group(uuid, uuid, text, uuid, int) from public, anon;
grant execute on function public.cal_save_group(uuid, uuid, text, uuid, int) to authenticated;
revoke all on function public.cal_save_item(uuid, uuid, text, int, date, int) from public, anon;
grant execute on function public.cal_save_item(uuid, uuid, text, int, date, int) to authenticated;
revoke all on function public.cal_save_counts(uuid, jsonb) from public, anon;
grant execute on function public.cal_save_counts(uuid, jsonb) to authenticated;
revoke all on function public.cal_set_active(text, uuid, boolean) from public, anon;
grant execute on function public.cal_set_active(text, uuid, boolean) to authenticated;
