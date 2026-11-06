-- Módulo "Remitos y Despachos" (Fase 1): funciones. ADITIVA (solo funciones remito_* nuevas).
-- Todas SECURITY DEFINER, mensajes en español, auditoría en remito_events.
-- Roles internos: admin, administracion (solo mira), logistica, calidad, obra_sitio, obra_calidad.

-- ---------------------------------------------------------------- helpers internos (sin acceso directo)
create or replace function public.remito_require(p_roles text[])
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
  v_role := remito_role();
  if v_role is null then raise exception 'Sin permiso para usar Remitos'; end if;
  if not (v_role = any (p_roles)) then
    raise exception 'Tu rol en Remitos (%) no puede hacer esta acción', v_role;
  end if;
  return v_role;
end;
$function$;

create or replace function public.remito_actor_name()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(nullif(btrim(full_name), ''), email) from profiles where id = auth.uid();
$function$;

create or replace function public.remito_log(p_entity text, p_id uuid, p_type text, p_note text default null, p_data jsonb default null)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  insert into remito_events (entity, entity_id, event_type, actor_id, actor_name, note, data)
  values (p_entity, p_id, p_type, auth.uid(), remito_actor_name(), p_note, p_data);
$function$;

-- Texto limpio: vacío = null.
create or replace function public.remito_txt(p_text text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select nullif(btrim(coalesce(p_text, '')), '');
$function$;

revoke all on function public.remito_require(text[]) from public, anon, authenticated;
revoke all on function public.remito_actor_name() from public, anon, authenticated;
revoke all on function public.remito_log(text, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.remito_txt(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- ítems y Calidad
create or replace function public.remito_create_item(
  p_code text, p_description text, p_rubric text, p_unit text, p_category text, p_stock numeric default 0)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text := remito_txt(p_code);
  v_desc text := remito_txt(p_description);
  v_id uuid;
begin
  perform remito_require(array['admin', 'logistica']);
  if v_code is null then raise exception 'El código es obligatorio'; end if;
  if v_desc is null then raise exception 'La descripción es obligatoria'; end if;
  if p_category is null or p_category not in ('permanente', 'retornable', 'consumible') then
    raise exception 'Categoría inválida';
  end if;
  if coalesce(p_stock, 0) < 0 then raise exception 'El stock inicial no puede ser negativo'; end if;
  if exists (select 1 from remito_items where lower(code) = lower(v_code)) then
    raise exception 'Ya existe un ítem con el código %', v_code;
  end if;

  insert into remito_items (code, description, rubric, unit, category, stock, created_by)
  values (v_code, v_desc, remito_txt(p_rubric), coalesce(remito_txt(p_unit), 'un'), p_category,
          coalesce(p_stock, 0), auth.uid())
  returning id into v_id;

  perform remito_log('item', v_id, 'alta', null,
    jsonb_build_object('code', v_code, 'category', p_category, 'stock', coalesce(p_stock, 0)));
  return v_id;
end;
$function$;

create or replace function public.remito_set_item_quality(p_item_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_item remito_items;
begin
  perform remito_require(array['admin', 'calidad']);
  if p_decision is null or p_decision not in ('aprobado', 'rechazado', 'pendiente') then
    raise exception 'Decisión inválida';
  end if;
  select * into v_item from remito_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'Ítem inexistente'; end if;
  if v_item.quality_status = p_decision then return; end if;

  update remito_items
     set quality_status = p_decision,
         quality_by = case when p_decision = 'pendiente' then null else auth.uid() end,
         quality_by_name = case when p_decision = 'pendiente' then null else remito_actor_name() end,
         quality_at = case when p_decision = 'pendiente' then null else now() end,
         updated_at = now()
   where id = p_item_id;

  perform remito_log('item', p_item_id, 'calidad_' || p_decision, null,
    jsonb_build_object('antes', v_item.quality_status, 'despues', p_decision));
end;
$function$;

create or replace function public.remito_adjust_stock(p_item_id uuid, p_delta numeric, p_note text default null)
returns numeric
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_item remito_items;
  v_new numeric;
begin
  perform remito_require(array['admin', 'logistica']);
  if p_delta is null or p_delta = 0 then raise exception 'La cantidad no puede ser cero'; end if;
  select * into v_item from remito_items where id = p_item_id for update;
  if v_item.id is null then raise exception 'Ítem inexistente'; end if;
  v_new := v_item.stock + p_delta;
  if v_new < 0 then
    raise exception 'El stock de % no puede quedar negativo (hay %)', v_item.code, v_item.stock;
  end if;
  update remito_items set stock = v_new, updated_at = now() where id = p_item_id;
  perform remito_log('item', p_item_id, 'stock', remito_txt(p_note),
    jsonb_build_object('antes', v_item.stock, 'despues', v_new, 'delta', p_delta));
  return v_new;
end;
$function$;

-- ---------------------------------------------------------------- despachos
-- p_header: kind, project_id, dispatched_at (ISO), reason, carrier_company, driver_name, driver_dni,
--           tractor_plate, trailer_plate, notes, driver_confirmed
-- p_lines:  [{item_id, qty, condition?, est_return_date?, official_no?, notes?}]
create or replace function public.remito_save_dispatch(p_dispatch_id uuid, p_header jsonb, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
  v_id uuid;
  v_kind text := remito_txt(p_header ->> 'kind');
  v_project uuid;
  v_when timestamptz;
  v_line jsonb;
  v_n int := 0;
  v_item remito_items;
  v_qty numeric;
  v_cond text;
  v_est date;
begin
  perform remito_require(array['admin', 'logistica']);
  if p_header is null or jsonb_typeof(p_header) <> 'object' then raise exception 'Faltan los datos del despacho'; end if;
  if v_kind is null or v_kind not in ('permanente', 'retornable', 'mixto') then
    raise exception 'Elegí el tipo de remito';
  end if;

  begin
    v_project := nullif(p_header ->> 'project_id', '')::uuid;
  exception when others then
    raise exception 'Proyecto inválido';
  end;
  if v_project is null or not exists (select 1 from remito_projects where id = v_project and active) then
    raise exception 'Elegí el proyecto de destino';
  end if;

  begin
    v_when := coalesce(nullif(p_header ->> 'dispatched_at', '')::timestamptz, now());
  exception when others then
    raise exception 'Fecha y hora de despacho inválida';
  end;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then p_lines := '[]'::jsonb; end if;

  if p_dispatch_id is null then
    insert into remito_dispatches (kind, project_id, dispatched_at, created_by, created_by_name)
    values (v_kind, v_project, v_when, auth.uid(), remito_actor_name())
    returning id into v_id;
  else
    select * into v_d from remito_dispatches where id = p_dispatch_id for update;
    if v_d.id is null then raise exception 'Despacho inexistente'; end if;
    if v_d.status <> 'borrador' then raise exception 'Solo se puede editar un despacho en borrador'; end if;
    v_id := v_d.id;
  end if;

  update remito_dispatches
     set kind = v_kind,
         project_id = v_project,
         dispatched_at = v_when,
         reason = remito_txt(p_header ->> 'reason'),
         carrier_company = remito_txt(p_header ->> 'carrier_company'),
         driver_name = remito_txt(p_header ->> 'driver_name'),
         driver_dni = remito_txt(p_header ->> 'driver_dni'),
         tractor_plate = upper(remito_txt(p_header ->> 'tractor_plate')),
         trailer_plate = upper(remito_txt(p_header ->> 'trailer_plate')),
         notes = remito_txt(p_header ->> 'notes'),
         driver_confirmed = coalesce((p_header ->> 'driver_confirmed')::boolean, false),
         updated_at = now()
   where id = v_id;

  delete from remito_dispatch_lines where dispatch_id = v_id;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    select * into v_item from remito_items where id = nullif(v_line ->> 'item_id', '')::uuid;
    if v_item.id is null or not v_item.active then raise exception 'Línea %: el ítem no existe', v_n; end if;
    if v_item.quality_status <> 'aprobado' then
      raise exception 'Línea %: el ítem % no está aprobado por Calidad', v_n, v_item.code;
    end if;
    begin
      v_qty := (v_line ->> 'qty')::numeric;
    exception when others then
      raise exception 'Línea %: cantidad inválida', v_n;
    end;
    if v_qty is null or v_qty <= 0 then raise exception 'Línea %: la cantidad debe ser mayor a cero', v_n; end if;
    v_cond := coalesce(remito_txt(v_line ->> 'condition'), v_item.category);
    if v_cond not in ('permanente', 'retornable', 'consumible') then
      raise exception 'Línea %: condición inválida', v_n;
    end if;
    if v_kind = 'permanente' and v_cond <> 'permanente' then
      raise exception 'Línea %: un remito Permanente solo lleva ítems permanentes', v_n;
    end if;
    if v_kind = 'retornable' and v_cond = 'permanente' then
      raise exception 'Línea %: un remito Retornable no lleva ítems permanentes (usá Mixto)', v_n;
    end if;
    begin
      v_est := nullif(v_line ->> 'est_return_date', '')::date;
    exception when others then
      raise exception 'Línea %: fecha de devolución inválida', v_n;
    end;
    insert into remito_dispatch_lines (dispatch_id, line_no, item_id, qty, condition, est_return_date, official_no, notes)
    values (v_id, v_n, v_item.id, v_qty, v_cond, v_est,
            remito_txt(v_line ->> 'official_no'), remito_txt(v_line ->> 'notes'));
  end loop;

  perform remito_log('dispatch', v_id, case when p_dispatch_id is null then 'borrador_creado' else 'borrador_editado' end,
    null, jsonb_build_object('lineas', v_n));
  return v_id;
end;
$function$;

create or replace function public.remito_attach_file(p_dispatch_id uuid, p_kind text, p_path text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
  v_id uuid;
begin
  perform remito_require(array['admin', 'logistica']);
  if p_kind is null or p_kind not in ('carga', 'patentes', 'remito_oficial', 'otro') then
    raise exception 'Tipo de archivo inválido';
  end if;
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status = 'anulado' then raise exception 'El despacho está anulado'; end if;
  if p_kind in ('carga', 'patentes') and v_d.status <> 'borrador' then
    raise exception 'Las fotos de salida solo se cargan en el borrador';
  end if;
  if remito_txt(p_path) is null or p_path not like p_dispatch_id::text || '/%' then
    raise exception 'Ruta de archivo inválida';
  end if;
  insert into remito_files (dispatch_id, kind, path, created_by)
  values (p_dispatch_id, p_kind, p_path, auth.uid())
  returning id into v_id;
  perform remito_log('dispatch', p_dispatch_id, 'archivo_' || p_kind, null, jsonb_build_object('path', p_path));
  return v_id;
end;
$function$;

-- Devuelve la ruta para que el cliente borre el objeto del bucket. Solo fotos de un borrador.
create or replace function public.remito_remove_file(p_file_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_f remito_files;
  v_d remito_dispatches;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_f from remito_files where id = p_file_id;
  if v_f.id is null then raise exception 'Archivo inexistente'; end if;
  select * into v_d from remito_dispatches where id = v_f.dispatch_id for update;
  if v_d.status <> 'borrador' then raise exception 'Solo se pueden quitar archivos de un borrador'; end if;
  delete from remito_files where id = p_file_id;
  perform remito_log('dispatch', v_d.id, 'archivo_quitado', null, jsonb_build_object('path', v_f.path));
  return v_f.path;
end;
$function$;

create or replace function public.remito_set_signature(p_dispatch_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status <> 'borrador' then raise exception 'La firma solo se carga en el borrador'; end if;
  if remito_txt(p_path) is not null and p_path not like p_dispatch_id::text || '/%' then
    raise exception 'Ruta de firma inválida';
  end if;
  update remito_dispatches set signature_path = remito_txt(p_path), updated_at = now() where id = p_dispatch_id;
  perform remito_log('dispatch', p_dispatch_id, case when remito_txt(p_path) is null then 'firma_quitada' else 'firma' end);
end;
$function$;

-- Confirmar la salida: valida candados, descuenta stock y asigna el número interno.
create or replace function public.remito_confirm_dispatch(p_dispatch_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
  v_no text;
  v_row record;
  v_pending text;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status <> 'borrador' then raise exception 'El despacho ya no está en borrador'; end if;

  if not exists (select 1 from remito_dispatch_lines where dispatch_id = v_d.id) then
    raise exception 'Cargá al menos un ítem en el camión';
  end if;
  if v_d.driver_name is null then raise exception 'Falta el nombre del chofer'; end if;
  if v_d.tractor_plate is null then raise exception 'Falta la patente del tractor'; end if;

  select string_agg(i.code, ', ') into v_pending
    from remito_dispatch_lines l join remito_items i on i.id = l.item_id
   where l.dispatch_id = v_d.id and i.quality_status <> 'aprobado';
  if v_pending is not null then
    raise exception 'Calidad todavía no aprobó: %', v_pending;
  end if;

  if not exists (select 1 from remito_files where dispatch_id = v_d.id and kind = 'carga') then
    raise exception 'Falta la foto de la carga sobre el camión';
  end if;
  if not exists (select 1 from remito_files where dispatch_id = v_d.id and kind = 'patentes') then
    raise exception 'Falta la foto de patentes / seguridad';
  end if;
  if v_d.signature_path is null and not v_d.driver_confirmed then
    raise exception 'Falta la firma del chofer (o confirmar su recepción)';
  end if;

  -- Stock: se bloquea cada ítem y se verifica el total pedido por ítem antes de descontar.
  for v_row in
    select i.id, i.code, sum(l.qty) as total
      from remito_dispatch_lines l join remito_items i on i.id = l.item_id
     where l.dispatch_id = v_d.id
     group by i.id, i.code
     order by i.id
  loop
    perform 1 from remito_items where id = v_row.id for update;
    if (select stock from remito_items where id = v_row.id) < v_row.total then
      raise exception 'Stock insuficiente de %: se piden % y hay %', v_row.code, v_row.total,
        (select stock from remito_items where id = v_row.id);
    end if;
    update remito_items set stock = stock - v_row.total, updated_at = now() where id = v_row.id;
  end loop;

  v_no := 'REM-' || lpad(nextval('remito_internal_seq')::text, 5, '0');
  update remito_dispatches
     set status = 'confirmado', internal_no = v_no, confirmed_by = auth.uid(),
         confirmed_by_name = remito_actor_name(), confirmed_at = now(), updated_at = now()
   where id = v_d.id;

  perform remito_log('dispatch', v_d.id, 'confirmado', null, jsonb_build_object('internal_no', v_no));
  return v_no;
end;
$function$;

create or replace function public.remito_cancel_dispatch(p_dispatch_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
  v_reason text := remito_txt(p_reason);
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status = 'anulado' then raise exception 'El despacho ya está anulado'; end if;
  if v_d.status = 'confirmado' and v_reason is null then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  -- Un confirmado que salió del stock lo repone (la carga histórica no lo tocó).
  if v_d.status = 'confirmado' and not v_d.is_historical then
    update remito_items i
       set stock = i.stock + t.total, updated_at = now()
      from (select item_id, sum(qty) as total from remito_dispatch_lines
             where dispatch_id = v_d.id group by item_id) t
     where i.id = t.item_id;
  end if;

  update remito_dispatches
     set status = 'anulado', cancelled_by = auth.uid(), cancelled_by_name = remito_actor_name(),
         cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
   where id = v_d.id;

  perform remito_log('dispatch', v_d.id, 'anulado', v_reason, jsonb_build_object('estaba', v_d.status));
end;
$function$;

-- N° de remito oficial: del encabezado (p_line_id null) o de una línea.
create or replace function public.remito_set_official_no(p_dispatch_id uuid, p_official_no text, p_line_id uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_d remito_dispatches;
begin
  perform remito_require(array['admin', 'logistica']);
  select * into v_d from remito_dispatches where id = p_dispatch_id for update;
  if v_d.id is null then raise exception 'Despacho inexistente'; end if;
  if v_d.status = 'anulado' then raise exception 'El despacho está anulado'; end if;
  if p_line_id is null then
    update remito_dispatches set official_no = remito_txt(p_official_no), updated_at = now() where id = v_d.id;
  else
    update remito_dispatch_lines set official_no = remito_txt(p_official_no)
     where id = p_line_id and dispatch_id = v_d.id;
    if not found then raise exception 'Línea inexistente'; end if;
  end if;
  perform remito_log('dispatch', v_d.id, 'remito_oficial', remito_txt(p_official_no),
    jsonb_build_object('linea', p_line_id));
end;
$function$;

-- Corregir la clasificación de una línea (solo administrador).
create or replace function public.remito_correct_line_condition(p_line_id uuid, p_condition text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_l remito_dispatch_lines;
begin
  perform remito_require(array['admin']);
  if p_condition is null or p_condition not in ('permanente', 'retornable', 'consumible') then
    raise exception 'Condición inválida';
  end if;
  select * into v_l from remito_dispatch_lines where id = p_line_id for update;
  if v_l.id is null then raise exception 'Línea inexistente'; end if;
  update remito_dispatch_lines set condition = p_condition where id = p_line_id;
  perform remito_log('dispatch', v_l.dispatch_id, 'clasificacion', null,
    jsonb_build_object('linea', v_l.line_no, 'antes', v_l.condition, 'despues', p_condition));
end;
$function$;

-- ---------------------------------------------------------------- permisos
do $$
declare
  f text;
begin
  foreach f in array array[
    'remito_create_item(text,text,text,text,text,numeric)',
    'remito_set_item_quality(uuid,text)',
    'remito_adjust_stock(uuid,numeric,text)',
    'remito_save_dispatch(uuid,jsonb,jsonb)',
    'remito_attach_file(uuid,text,text)',
    'remito_remove_file(uuid)',
    'remito_set_signature(uuid,text)',
    'remito_confirm_dispatch(uuid)',
    'remito_cancel_dispatch(uuid,text)',
    'remito_set_official_no(uuid,text,uuid)',
    'remito_correct_line_condition(uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
