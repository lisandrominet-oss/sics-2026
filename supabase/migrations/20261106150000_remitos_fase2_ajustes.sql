-- Remitos, Fase 2: ajustes tras la revisión independiente. Solo objetos remito_*.

-- C1) Sin rol no hay acceso. Antes, quien tenía el módulo habilitado y no tenía rol (o tenía el rol desactivado)
--     caía en "administracion" y leía todo. Ahora: fila activa = su rol; admin de SICS = admin; el resto, sin acceso.
--     El jefe de área entra con una fila `administracion` explícita.
create or replace function public.remito_role()
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
  if not has_module('remitos', true) then return null; end if;
  select * into v_p from profiles where id = auth.uid() and active;
  if v_p.id is null then return null; end if;
  select role into v_r from remito_staff where user_id = auth.uid() and active;
  if v_r is not null then return v_r; end if;
  if v_p.role = 'admin' then return 'admin'; end if;
  return null;
end;
$function$;

-- Rol para LEER: igual que remito_role(), pero un admin que simula otro rol ("Ver como") sigue pudiendo leer.
create or replace function public.remito_role_any()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v text;
begin
  if auth.uid() is null then return null; end if;
  v := remito_role();
  if v is not null then return v; end if;
  if has_module('remitos') and exists (select 1 from profiles where id = auth.uid() and active and role = 'admin') then
    return 'admin';
  end if;
  return null;
end;
$function$;
revoke all on function public.remito_role_any() from public, anon;
grant execute on function public.remito_role_any() to authenticated;

create or replace function public.remito_can_see_project(p_project uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := remito_role_any();
begin
  if v_role is null then return false; end if;
  if v_role = 'panol_proyecto' then
    return exists (select 1 from remito_staff where user_id = auth.uid() and active and project_id = p_project);
  end if;
  return true;
end;
$function$;

create or replace function public.remito_can_see_dispatch(p_project uuid, p_status text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text := remito_role_any();
begin
  if v_role is null then return false; end if;
  if v_role = 'panol_proyecto' and p_status <> 'confirmado' then return false; end if;
  return remito_can_see_project(p_project);
end;
$function$;

-- Todas las lecturas pasan a depender del rol del módulo (no solo de tener el módulo habilitado).
drop policy if exists remito_projects_select on public.remito_projects;
create policy remito_projects_select on public.remito_projects for select to authenticated
  using ((select remito_can_see_project(id)));

drop policy if exists remito_items_select on public.remito_items;
create policy remito_items_select on public.remito_items for select to authenticated
  using ((select remito_role_any()) is not null);

drop policy if exists remito_staff_select on public.remito_staff;
create policy remito_staff_select on public.remito_staff for select to authenticated
  using ((select remito_role_any()) is not null and (user_id = auth.uid() or (select remito_role_any()) <> 'panol_proyecto'));

drop policy if exists remito_dispatches_select on public.remito_dispatches;
create policy remito_dispatches_select on public.remito_dispatches for select to authenticated
  using ((select remito_can_see_dispatch(project_id, status)));

drop policy if exists remito_dispatch_lines_select on public.remito_dispatch_lines;
create policy remito_dispatch_lines_select on public.remito_dispatch_lines for select to authenticated
  using (exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

drop policy if exists remito_files_select on public.remito_files;
create policy remito_files_select on public.remito_files for select to authenticated
  using (exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

drop policy if exists remito_events_select on public.remito_events;
create policy remito_events_select on public.remito_events for select to authenticated
  using (
    (select remito_role_any()) is not null
    and (entity = 'item'
         or (entity = 'dispatch' and exists (select 1 from public.remito_dispatches d where d.id = entity_id))
         or (entity = 'egress' and exists (select 1 from public.remito_egresses e where e.id = entity_id))
         or (entity = 'staff' and (select remito_role_any()) in ('admin', 'administracion')))
  );

drop policy if exists remito_receptions_select on public.remito_receptions;
create policy remito_receptions_select on public.remito_receptions for select to authenticated
  using (exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

drop policy if exists remito_site_movements_select on public.remito_site_movements;
create policy remito_site_movements_select on public.remito_site_movements for select to authenticated
  using ((select remito_can_see_project(project_id)));

drop policy if exists remito_egresses_select on public.remito_egresses;
create policy remito_egresses_select on public.remito_egresses for select to authenticated
  using ((select remito_can_see_project(project_id)));

drop policy if exists remito_egress_lines_select on public.remito_egress_lines;
create policy remito_egress_lines_select on public.remito_egress_lines for select to authenticated
  using (exists (select 1 from public.remito_egresses e where e.id = egress_id));

drop policy if exists remito_files_storage_select on storage.objects;
create policy remito_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'remito-files'
    and exists (select 1 from public.remito_dispatches d where d.id::text = (storage.foldername(name))[1])
  );

-- C2) No se puede anular un despacho que ya fue recibido en obra: el libro de stock del proyecto quedaría
--     descuadrado. El camino correcto es que el proyecto emita un egreso (devolución).
create or replace function public.remito_cancel_dispatch(p_dispatch_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
  v_reason text := remito_txt(p_reason);
  v_row record;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status = 'anulado' then raise exception 'El despacho ya está anulado'; end if;
  if v_d.status = 'confirmado' and v_reason is null then
    raise exception 'Indicá el motivo de la anulación';
  end if;
  if exists (select 1 from remito_receptions where dispatch_id = v_d.id) then
    raise exception 'Este despacho ya fue recibido en obra y no se puede anular. Si hay que devolverlo, el proyecto emite un egreso.';
  end if;

  if v_d.status = 'confirmado' and not v_d.is_historical then
    for v_row in
      select l.item_id, sum(l.qty) as total
        from remito_dispatch_lines l
       where l.dispatch_id = v_d.id
       group by l.item_id
       order by l.item_id
    loop
      perform 1 from remito_items where id = v_row.item_id for update;
      update remito_items set stock = stock + v_row.total, updated_at = now() where id = v_row.item_id;
    end loop;
  end if;

  update remito_dispatches
     set status = 'anulado', cancelled_by = auth.uid(), cancelled_by_name = remito_actor_name(),
         cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
   where id = v_d.id;

  perform remito_log('dispatch', v_d.id, 'anulado', v_reason, jsonb_build_object('estaba', v_d.status));
end;
$function$;

-- I3) Cantidades: se redondean a 2 decimales (como las columnas) antes de validar y comparar.
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
      v_qty := round((v_in ->> 'received_qty')::numeric, 2);
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
      v_qty := round((v_line ->> 'qty')::numeric, 2);
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
        v_qty := round((v_in ->> 'received_qty')::numeric, 2);
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

-- I1 + I2) Roles del módulo: el admin de SICS no puede quitarse el rol de admin, y solo se asigna rol a quien ya
--          tiene el módulo habilitado (la baja se permite siempre).
create or replace function public.remito_set_staff(p_user_id uuid, p_role text, p_project_id uuid default null, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p profiles;
begin
  perform remito_require(array['admin']);
  if p_role is null or p_role not in ('admin', 'administracion', 'logistica', 'calidad', 'panol_proyecto') then
    raise exception 'Rol inválido';
  end if;
  select * into v_p from profiles where id = p_user_id;
  if v_p.id is null then raise exception 'El usuario no existe'; end if;
  if v_p.role = 'admin' and (p_role <> 'admin' or not coalesce(p_active, true)) then
    raise exception 'Un administrador de SICS siempre es administrador de Remitos';
  end if;
  if coalesce(p_active, true) then
    if not v_p.active then raise exception 'El usuario está inactivo'; end if;
    if v_p.role <> 'admin' and coalesce((v_p.module_overrides ->> 'remitos')::boolean, false) is not true then
      raise exception 'Primero habilitá el módulo Remitos a esta persona (Usuarios → Módulos)';
    end if;
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

-- Baja real: quita el rol del módulo (la persona queda sin acceso).
create or replace function public.remito_remove_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old remito_staff;
begin
  perform remito_require(array['admin']);
  if exists (select 1 from profiles where id = p_user_id and role = 'admin') then
    raise exception 'Un administrador de SICS siempre es administrador de Remitos';
  end if;
  delete from remito_staff where user_id = p_user_id returning * into v_old;
  if v_old.user_id is null then raise exception 'Esa persona no tiene rol en Remitos'; end if;
  perform remito_log('staff', p_user_id, 'rol_quitado', v_old.role, jsonb_build_object('proyecto', v_old.project_id));
end;
$function$;

revoke all on function public.remito_remove_staff(uuid) from public, anon;
grant execute on function public.remito_remove_staff(uuid) to authenticated;
revoke all on function public.remito_cancel_dispatch(uuid, text) from public, anon;
grant execute on function public.remito_cancel_dispatch(uuid, text) to authenticated;
revoke all on function public.remito_receive_dispatch(uuid, jsonb, text) from public, anon;
grant execute on function public.remito_receive_dispatch(uuid, jsonb, text) to authenticated;
revoke all on function public.remito_create_egress(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.remito_create_egress(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.remito_receive_egress(uuid, jsonb, text) from public, anon;
grant execute on function public.remito_receive_egress(uuid, jsonb, text) to authenticated;
revoke all on function public.remito_set_staff(uuid, text, uuid, boolean) from public, anon;
grant execute on function public.remito_set_staff(uuid, text, uuid, boolean) to authenticated;
