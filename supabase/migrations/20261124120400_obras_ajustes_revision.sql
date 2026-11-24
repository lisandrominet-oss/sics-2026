-- Ajustes de la revisión del módulo Obras.
-- 1) set_sic_project_node: Ingeniería solo reclasifica SIC de su área (las que ve); Compras y admin, cualquiera;
--    quien emitió, mientras la SIC sea editable. Sin cambios para el resto.
-- 2) obra_reimport: registra los cambios de nombre en el historial y conserva las fechas puestas a mano en un WBS
--    (los WBS de Primavera llegan sin fechas propias).

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
    or (can_manage_obras() and is_area_member_of_plant(v_sic.plant_id))
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

revoke execute on function public.set_sic_project_node(uuid, uuid) from public, anon;
grant execute on function public.set_sic_project_node(uuid, uuid) to authenticated, service_role;

create or replace function public.obra_reimport(p_project_id uuid, p_nodes jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_map jsonb := '{}'::jsonb;
  v_seen uuid[] := '{}';
  v_node jsonb;
  v_ord bigint;
  v_kind text;
  v_ext text;
  v_parent uuid;
  v_existing project_nodes;
  v_id uuid;
  v_cs date; v_ce date; v_bs date; v_be date;
  v_new int := 0;
  v_moved int := 0;
  v_renamed int := 0;
  v_reactivated int := 0;
  v_deactivated int := 0;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not can_manage_obras() then raise exception 'Solo Ingeniería o un administrador pueden actualizar obras'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Indicá el motivo de la actualización'; end if;
  if not exists (select 1 from projects where id = p_project_id) then raise exception 'Proyecto no encontrado'; end if;
  if not exists (select 1 from project_nodes where project_id = p_project_id) then
    raise exception 'La obra no tiene plan: usá "Importar desde Primavera"';
  end if;
  if jsonb_typeof(p_nodes) is distinct from 'array' or jsonb_array_length(p_nodes) < 1 then
    raise exception 'El plan no tiene ítems';
  end if;
  if jsonb_array_length(p_nodes) > 10000 then raise exception 'El plan tiene más de 10.000 ítems'; end if;

  for v_node, v_ord in select e, o from jsonb_array_elements(p_nodes) with ordinality as t(e, o) loop
    v_kind := v_node->>'kind';
    v_ext := nullif(trim(v_node->>'external_id'), '');
    if v_kind not in ('wbs', 'actividad') then raise exception 'Fila %: tipo inválido', v_ord; end if;
    if nullif(trim(v_node->>'ref'), '') is null or v_ext is null then raise exception 'Fila %: falta el identificador', v_ord; end if;
    if nullif(trim(v_node->>'name'), '') is null then raise exception 'Fila %: falta el nombre', v_ord; end if;
    if v_map ? (v_node->>'ref') then raise exception 'Fila %: identificador repetido (%)', v_ord, v_node->>'ref'; end if;

    if nullif(v_node->>'parent_ref', '') is null then
      v_parent := null;
    elsif v_map ? (v_node->>'parent_ref') then
      v_parent := (v_map->>(v_node->>'parent_ref'))::uuid;
    else
      raise exception 'Fila %: el padre % no aparece antes', v_ord, v_node->>'parent_ref';
    end if;

    v_cs := nullif(v_node->>'current_start', '')::date;
    v_ce := nullif(v_node->>'current_end', '')::date;
    v_bs := coalesce(nullif(v_node->>'baseline_start', '')::date, v_cs);
    v_be := coalesce(nullif(v_node->>'baseline_end', '')::date, v_ce);

    select * into v_existing from project_nodes
    where project_id = p_project_id and kind = v_kind and external_id = v_ext
    for update;

    -- Los WBS de Primavera llegan sin fechas propias: si alguien les puso fechas a mano, se conservan.
    if v_existing.id is not null and v_kind = 'wbs' and v_cs is null and v_ce is null then
      v_cs := v_existing.current_start;
      v_ce := v_existing.current_end;
    end if;

    if v_existing.id is null then
      insert into project_nodes (project_id, parent_id, kind, external_id, code, name, position,
                                 baseline_start, baseline_end, current_start, current_end)
      values (p_project_id, v_parent, v_kind, v_ext,
              coalesce(nullif(trim(v_node->>'code'), ''), v_ext), trim(v_node->>'name'), v_ord::int,
              v_bs, v_be, v_cs, v_ce)
      returning id into v_id;
      v_new := v_new + 1;
      insert into project_node_changes (project_id, node_id, change_type, origin, new_start, new_end, detail, reason, actor_id)
      values (p_project_id, v_id, 'alta', 'reimportacion', v_cs, v_ce,
              'Nuevo en Primavera: ' || coalesce(nullif(trim(v_node->>'code'), ''), v_ext) || ' ' || trim(v_node->>'name'),
              trim(p_reason), v_uid);
    else
      v_id := v_existing.id;

      if v_existing.current_start is distinct from v_cs or v_existing.current_end is distinct from v_ce then
        v_moved := v_moved + 1;
        insert into project_node_changes (project_id, node_id, change_type, origin, old_start, old_end, new_start, new_end, reason, actor_id)
        values (p_project_id, v_id, 'plazo', 'reimportacion', v_existing.current_start, v_existing.current_end, v_cs, v_ce, trim(p_reason), v_uid);
      end if;
      if v_existing.name is distinct from trim(v_node->>'name')
         or v_existing.code is distinct from coalesce(nullif(trim(v_node->>'code'), ''), v_ext) then
        v_renamed := v_renamed + 1;
        insert into project_node_changes (project_id, node_id, change_type, origin, detail, reason, actor_id)
        values (p_project_id, v_id, 'nombre', 'reimportacion',
                v_existing.code || ' ' || v_existing.name || ' → ' || coalesce(nullif(trim(v_node->>'code'), ''), v_ext) || ' ' || trim(v_node->>'name'),
                trim(p_reason), v_uid);
      end if;
      if not v_existing.active then
        v_reactivated := v_reactivated + 1;
        insert into project_node_changes (project_id, node_id, change_type, origin, detail, reason, actor_id)
        values (p_project_id, v_id, 'reactivacion', 'reimportacion', 'Volvió a aparecer en Primavera', trim(p_reason), v_uid);
      end if;

      update project_nodes set
        parent_id = v_parent,
        code = coalesce(nullif(trim(v_node->>'code'), ''), v_ext),
        name = trim(v_node->>'name'),
        position = v_ord::int,
        active = true,
        current_start = v_cs,
        current_end = v_ce,
        baseline_start = coalesce(baseline_start, v_bs),
        baseline_end = coalesce(baseline_end, v_be),
        updated_at = now()
      where id = v_id;
    end if;

    v_map := v_map || jsonb_build_object(v_node->>'ref', v_id);
    v_seen := v_seen || v_id;
  end loop;

  -- Lo que ya no viene en Primavera se da de baja (los ítems agregados a mano quedan como están).
  with gone as (
    update project_nodes n set active = false, updated_at = now()
    where n.project_id = p_project_id and n.active and n.external_id not like 'manual-%' and not (n.id = any(v_seen))
    returning n.id, n.code, n.name
  )
  insert into project_node_changes (project_id, node_id, change_type, origin, detail, reason, actor_id)
  select p_project_id, g.id, 'baja', 'reimportacion', 'Ya no está en Primavera: ' || g.code || ' ' || g.name, trim(p_reason), v_uid
  from gone g;
  get diagnostics v_deactivated = row_count;

  -- Un ítem puede haber cambiado de padre: se recalculan la ruta de ancestros y la profundidad de toda la obra.
  with recursive t as (
    select id, array[id] as path from project_nodes where project_id = p_project_id and parent_id is null
    union all
    select n.id, t.path || n.id from project_nodes n join t on n.parent_id = t.id
  )
  update project_nodes n set path = t.path, depth = array_length(t.path, 1) - 1
  from t where t.id = n.id and (n.path is distinct from t.path or n.depth <> array_length(t.path, 1) - 1);

  update projects set imported_at = now(), imported_by = v_uid where id = p_project_id;

  insert into project_node_changes (project_id, change_type, origin, detail, reason, actor_id)
  values (p_project_id, 'importacion', 'reimportacion',
          format('Actualizado desde Primavera: %s nuevos, %s con plazos cambiados, %s dados de baja, %s reactivados, %s renombrados',
                 v_new, v_moved, v_deactivated, v_reactivated, v_renamed),
          trim(p_reason), v_uid);

  return jsonb_build_object('nuevos', v_new, 'plazos', v_moved, 'bajas', v_deactivated, 'reactivados', v_reactivated, 'renombrados', v_renamed);
end;
$$;

revoke execute on function public.obra_reimport(uuid, jsonb, text) from public, anon;
grant execute on function public.obra_reimport(uuid, jsonb, text) to authenticated, service_role;
