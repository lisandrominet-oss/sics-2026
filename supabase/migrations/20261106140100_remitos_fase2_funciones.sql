-- Remitos, Fase 2: funciones (recepción, stock en obra, egresos, roles del módulo). Solo funciones remito_*.

-- Stock actual de un ítem en un proyecto (suma del libro). Interno: lo usan las RPC con el proyecto bloqueado.
create or replace function public.remito_site_qty(p_project uuid, p_item uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(qty), 0) from remito_site_movements where project_id = p_project and item_id = p_item;
$function$;
revoke all on function public.remito_site_qty(uuid, uuid) from public, anon, authenticated;

-- Resumen de lo que hay en obra por ítem. Corre con los permisos del usuario: el pañolero de proyecto
-- solo obtiene filas de su proyecto (RLS). enviado = confirmado; sin aceptar = sin recepción; faltante = no llegó.
create or replace function public.remito_site_stock(p_project uuid)
returns table (
  item_id uuid, code text, description text, rubric text, unit text, category text,
  sent numeric, pending numeric, received numeric, missing numeric, out_qty numeric, in_site numeric
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with l as (
    select dl.item_id,
           sum(dl.qty) as sent,
           sum(case when dl.received_qty is null then dl.qty else 0 end) as pending,
           sum(coalesce(dl.received_qty, 0)) as received,
           sum(case when dl.received_qty is not null then dl.qty - dl.received_qty else 0 end) as missing
      from remito_dispatch_lines dl
      join remito_dispatches d on d.id = dl.dispatch_id
     where d.project_id = p_project and d.status = 'confirmado'
     group by dl.item_id
  ), m as (
    select item_id,
           sum(qty) as in_site,
           -sum(case when kind in ('egreso', 'reposicion') then qty else 0 end) as out_qty
      from remito_site_movements
     where project_id = p_project
     group by item_id
  )
  select i.id, i.code, i.description, i.rubric, i.unit, i.category,
         coalesce(l.sent, 0), coalesce(l.pending, 0), coalesce(l.received, 0), coalesce(l.missing, 0),
         coalesce(m.out_qty, 0), coalesce(m.in_site, 0)
    from remito_items i
    left join l on l.item_id = i.id
    left join m on m.item_id = i.id
   where l.item_id is not null or m.item_id is not null
   order by i.category, i.description;
$function$;
revoke all on function public.remito_site_stock(uuid) from public, anon;
grant execute on function public.remito_site_stock(uuid) to authenticated;

-- ---------------------------------------------------------------- recepción en obra
-- p_lines: [{line_id, received_qty, note?}] con TODAS las líneas del despacho. received_qty 0 = "no llegó".
-- Solo registra y corrige el stock en obra: el stock del taller ya se descontó al despachar.
create or replace function public.remito_receive_dispatch(p_dispatch_id uuid, p_lines jsonb, p_note text default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_d remito_dispatches;
  v_line remito_dispatch_lines;
  v_in jsonb;
  v_lid uuid;
  v_qty numeric;
  v_diff boolean := false;
  v_n int := 0;
  v_total int;
  v_status text;
begin
  v_role := remito_require(array['admin', 'panol_proyecto']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status <> 'confirmado' then raise exception 'Solo se puede recibir un despacho confirmado'; end if;
  if v_role = 'panol_proyecto' and not exists (
    select 1 from remito_staff where user_id = auth.uid() and active and project_id = v_d.project_id
  ) then
    raise exception 'Este despacho no es de tu proyecto';
  end if;
  if exists (select 1 from remito_receptions where dispatch_id = v_d.id) then
    raise exception 'Este despacho ya fue recibido';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Faltan las cantidades recibidas'; end if;
  select count(*) into v_total from remito_dispatch_lines where dispatch_id = v_d.id;
  if jsonb_array_length(p_lines) <> v_total then
    raise exception 'Indicá lo recibido de cada una de las % líneas', v_total;
  end if;

  for v_in in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    begin
      v_lid := (v_in ->> 'line_id')::uuid;
    exception when others then
      raise exception 'Línea %: identificador inválido', v_n;
    end;
    select * into v_line from remito_dispatch_lines where id = v_lid and dispatch_id = v_d.id;
    if v_line.id is null then raise exception 'Línea %: no pertenece a este despacho', v_n; end if;
    if v_line.received_qty is not null then raise exception 'Línea %: repetida', v_n; end if;
    begin
      v_qty := (v_in ->> 'received_qty')::numeric;
    exception when others then
      raise exception 'Línea %: cantidad inválida', v_n;
    end;
    if v_qty is null or v_qty < 0 or v_qty > v_line.qty then
      raise exception 'Línea %: lo recibido tiene que estar entre 0 y %', v_n, v_line.qty;
    end if;

    update remito_dispatch_lines
       set received_qty = v_qty, received_note = remito_txt(v_in ->> 'note')
     where id = v_line.id;
    if v_qty <> v_line.qty then v_diff := true; end if;
    if v_qty > 0 then
      insert into remito_site_movements (project_id, item_id, kind, qty, ref_type, ref_id, created_by)
      values (v_d.project_id, v_line.item_id, 'recepcion', v_qty, 'dispatch', v_d.id, auth.uid());
    end if;
  end loop;

  v_status := case when v_diff then 'con_diferencias' else 'aceptado' end;
  insert into remito_receptions (dispatch_id, status, received_by, received_by_name, note)
  values (v_d.id, v_status, auth.uid(), remito_actor_name(), remito_txt(p_note));

  perform remito_log('dispatch', v_d.id, 'recepcion_' || v_status, remito_txt(p_note), jsonb_build_object('lineas', v_total));
  return v_status;
end;
$function$;

-- ---------------------------------------------------------------- egresos (lo que baja del proyecto)
-- p_header: reason, carrier_company, driver_name, driver_dni, tractor_plate, trailer_plate, notes
-- p_lines:  [{item_id, qty, notes?}]  (no puede superar lo que hay en obra)
-- Al emitir, el stock del proyecto se descuenta; el del taller suma cuando el taller confirma la recepción.
create or replace function public.remito_create_egress(p_project_id uuid, p_header jsonb, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_id uuid;
  v_no text;
  v_line jsonb;
  v_n int := 0;
  v_item_id uuid;
  v_item remito_items;
  v_qty numeric;
begin
  v_role := remito_require(array['admin', 'panol_proyecto']);
  if p_project_id is null or not exists (select 1 from remito_projects where id = p_project_id and active) then
    raise exception 'Elegí el proyecto';
  end if;
  if v_role = 'panol_proyecto' and not exists (
    select 1 from remito_staff where user_id = auth.uid() and active and project_id = p_project_id
  ) then
    raise exception 'Solo podés emitir egresos de tu proyecto';
  end if;
  if p_header is null or jsonb_typeof(p_header) <> 'object' then p_header := '{}'::jsonb; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cargá al menos un ítem en el egreso';
  end if;

  -- Un egreso por proyecto a la vez: evita que dos emisiones simultáneas pasen más de lo que hay.
  perform pg_advisory_xact_lock(hashtext('remito_site:' || p_project_id::text));

  v_no := 'EGR-' || lpad(nextval('remito_egress_seq')::text, 5, '0');
  insert into remito_egresses (internal_no, project_id, reason, carrier_company, driver_name, driver_dni,
                               tractor_plate, trailer_plate, notes, created_by, created_by_name)
  values (v_no, p_project_id, remito_txt(p_header ->> 'reason'), remito_txt(p_header ->> 'carrier_company'),
          remito_txt(p_header ->> 'driver_name'), remito_txt(p_header ->> 'driver_dni'),
          upper(remito_txt(p_header ->> 'tractor_plate')), upper(remito_txt(p_header ->> 'trailer_plate')),
          remito_txt(p_header ->> 'notes'), auth.uid(), remito_actor_name())
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    begin
      v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    exception when others then
      raise exception 'Línea %: ítem inválido', v_n;
    end;
    select * into v_item from remito_items where id = v_item_id;
    if v_item.id is null then raise exception 'Línea %: el ítem no existe', v_n; end if;
    begin
      v_qty := (v_line ->> 'qty')::numeric;
      if v_qty > 999999999 then raise exception 'x'; end if;
    exception when others then
      raise exception 'Línea %: cantidad inválida', v_n;
    end;
    if v_qty is null or v_qty <= 0 then raise exception 'Línea %: la cantidad debe ser mayor a cero', v_n; end if;
    if v_qty > remito_site_qty(p_project_id, v_item.id) then
      raise exception 'Línea %: de % solo hay % en obra', v_n, v_item.code, remito_site_qty(p_project_id, v_item.id);
    end if;

    insert into remito_egress_lines (egress_id, line_no, item_id, qty, condition, notes)
    values (v_id, v_n, v_item.id, v_qty, v_item.category, remito_txt(v_line ->> 'notes'));
    insert into remito_site_movements (project_id, item_id, kind, qty, ref_type, ref_id, created_by)
    values (p_project_id, v_item.id, 'egreso', -v_qty, 'egress', v_id, auth.uid());
  end loop;

  perform remito_log('egress', v_id, 'egreso_emitido', null, jsonb_build_object('internal_no', v_no, 'lineas', v_n));
  return v_id;
end;
$function$;

-- El taller confirma la recepción del egreso: suma al stock del catálogo lo que realmente llegó.
-- p_lines (opcional): [{line_id, received_qty}]; las líneas que no se informan se toman completas.
create or replace function public.remito_receive_egress(p_egress_id uuid, p_lines jsonb default null, p_note text default null)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_e remito_egresses;
  v_row record;
  v_in jsonb;
  v_lid uuid;
  v_qty numeric;
  v_n int := 0;
  v_diff boolean := false;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_e from remito_egresses where id = p_egress_id for update;
  if v_e.id is null then raise exception 'Egreso inexistente'; end if;
  if v_e.status <> 'en_camino' then raise exception 'El egreso ya no está en camino'; end if;
  if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then raise exception 'Cantidades inválidas'; end if;

  update remito_egress_lines set received_qty = qty where egress_id = v_e.id;
  if p_lines is not null then
    for v_in in select * from jsonb_array_elements(p_lines) loop
      v_n := v_n + 1;
      begin
        v_lid := (v_in ->> 'line_id')::uuid;
        v_qty := (v_in ->> 'received_qty')::numeric;
      exception when others then
        raise exception 'Línea %: datos inválidos', v_n;
      end;
      if v_qty is null or v_qty < 0 then raise exception 'Línea %: cantidad inválida', v_n; end if;
      update remito_egress_lines set received_qty = v_qty
       where id = v_lid and egress_id = v_e.id and v_qty <= qty;
      if not found then raise exception 'Línea %: no pertenece al egreso o supera lo enviado', v_n; end if;
    end loop;
  end if;

  for v_row in
    select item_id, sum(received_qty) as total, sum(qty) as sent
      from remito_egress_lines where egress_id = v_e.id group by item_id order by item_id
  loop
    if v_row.total <> v_row.sent then v_diff := true; end if;
    perform 1 from remito_items where id = v_row.item_id for update;
    update remito_items set stock = stock + v_row.total, updated_at = now() where id = v_row.item_id;
  end loop;

  update remito_egresses
     set status = 'recibido', received_by = auth.uid(), received_by_name = remito_actor_name(),
         received_at = now(), received_note = remito_txt(p_note), updated_at = now()
   where id = v_e.id;

  perform remito_log('egress', v_e.id, case when v_diff then 'egreso_recibido_con_diferencias' else 'egreso_recibido' end,
    remito_txt(p_note), null);
  return case when v_diff then 'con_diferencias' else 'recibido' end;
end;
$function$;

-- Anular un egreso en camino (lo anula el proyecto, o el taller si lo rechaza): el stock vuelve al proyecto.
create or replace function public.remito_cancel_egress(p_egress_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_e remito_egresses;
  v_reason text := remito_txt(p_reason);
  v_row record;
begin
  v_role := remito_require(array['admin', 'logistica', 'panol_proyecto']);
  select * into v_e from remito_egresses where id = p_egress_id for update;
  if v_e.id is null then raise exception 'Egreso inexistente'; end if;
  if v_role = 'panol_proyecto' and not exists (
    select 1 from remito_staff where user_id = auth.uid() and active and project_id = v_e.project_id
  ) then
    raise exception 'Este egreso no es de tu proyecto';
  end if;
  if v_e.status <> 'en_camino' then raise exception 'Solo se puede anular un egreso que está en camino'; end if;
  if v_reason is null then raise exception 'Indicá el motivo'; end if;

  perform pg_advisory_xact_lock(hashtext('remito_site:' || v_e.project_id::text));
  for v_row in
    select item_id, sum(qty) as total from remito_egress_lines where egress_id = v_e.id group by item_id order by item_id
  loop
    insert into remito_site_movements (project_id, item_id, kind, qty, ref_type, ref_id, created_by)
    values (v_e.project_id, v_row.item_id, 'reposicion', v_row.total, 'egress', v_e.id, auth.uid());
  end loop;

  update remito_egresses
     set status = 'anulado', cancelled_by = auth.uid(), cancelled_by_name = remito_actor_name(),
         cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
   where id = v_e.id;
  perform remito_log('egress', v_e.id, 'egreso_anulado', v_reason, null);
end;
$function$;

-- ---------------------------------------------------------------- roles del módulo (solo administrador)
create or replace function public.remito_set_staff(p_user_id uuid, p_role text, p_project_id uuid default null, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform remito_require(array['admin']);
  if p_role is null or p_role not in ('admin', 'administracion', 'logistica', 'calidad', 'panol_proyecto') then
    raise exception 'Rol inválido';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and active) then
    raise exception 'El usuario no existe o está inactivo';
  end if;
  if p_role = 'panol_proyecto' then
    if p_project_id is null or not exists (select 1 from remito_projects where id = p_project_id and active) then
      raise exception 'El pañolero de proyecto necesita un proyecto';
    end if;
  elsif p_project_id is not null then
    raise exception 'Solo el pañolero de proyecto lleva proyecto';
  end if;

  insert into remito_staff (user_id, role, project_id, active)
  values (p_user_id, p_role, p_project_id, coalesce(p_active, true))
  on conflict (user_id) do update
    set role = excluded.role, project_id = excluded.project_id, active = excluded.active, updated_at = now();

  perform remito_log('staff', p_user_id, 'rol_asignado', p_role,
    jsonb_build_object('proyecto', p_project_id, 'activo', coalesce(p_active, true)));
end;
$function$;

-- ---------------------------------------------------------------- permisos
do $$
declare
  f text;
begin
  foreach f in array array[
    'remito_receive_dispatch(uuid,jsonb,text)',
    'remito_create_egress(uuid,jsonb,jsonb)',
    'remito_receive_egress(uuid,jsonb,text)',
    'remito_cancel_egress(uuid,text)',
    'remito_set_staff(uuid,text,uuid,boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
