-- Remitos: ajustes tras la revisión independiente. Solo toca objetos remito_* y policies propias del bucket remito-files.

-- 1) Storage: las fotos y firmas de un despacho confirmado son evidencia y no se pueden borrar desde el cliente.
--    Subir: solo a la carpeta de un despacho que existe y no está anulado. Borrar: solo si sigue en borrador.
drop policy if exists remito_files_storage_insert on storage.objects;
create policy remito_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'remito-files'
    and (select remito_role()) in ('admin', 'logistica')
    and exists (
      select 1 from public.remito_dispatches d
       where d.id::text = (storage.foldername(name))[1] and d.status <> 'anulado'
    )
  );

drop policy if exists remito_files_storage_delete on storage.objects;
create policy remito_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'remito-files'
    and (select remito_role()) in ('admin', 'logistica')
    and exists (
      select 1 from public.remito_dispatches d
       where d.id::text = (storage.foldername(name))[1] and d.status = 'borrador'
    )
  );

-- 2) Las fotos y la firma tienen que existir de verdad en Storage.
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
  if not exists (select 1 from storage.objects where bucket_id = 'remito-files' and name = p_path) then
    raise exception 'El archivo todavía no se subió';
  end if;
  insert into remito_files (dispatch_id, kind, path, created_by)
  values (p_dispatch_id, p_kind, p_path, auth.uid())
  returning id into v_id;
  perform remito_log('dispatch', p_dispatch_id, 'archivo_' || p_kind, null, jsonb_build_object('path', p_path));
  return v_id;
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
  if remito_txt(p_path) is not null then
    if p_path not like p_dispatch_id::text || '/%' then raise exception 'Ruta de firma inválida'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'remito-files' and name = p_path) then
      raise exception 'La firma todavía no se subió';
    end if;
  end if;
  update remito_dispatches set signature_path = remito_txt(p_path), updated_at = now() where id = p_dispatch_id;
  perform remito_log('dispatch', p_dispatch_id, case when remito_txt(p_path) is null then 'firma_quitada' else 'firma' end);
end;
$function$;

-- 3) Confirmar: la aprobación de Calidad se revisa DESPUÉS de bloquear cada ítem (sin ventana de carrera).
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
  v_item remito_items;
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

  if not exists (select 1 from remito_files where dispatch_id = v_d.id and kind = 'carga') then
    raise exception 'Falta la foto de la carga sobre el camión';
  end if;
  if not exists (select 1 from remito_files where dispatch_id = v_d.id and kind = 'patentes') then
    raise exception 'Falta la foto de patentes / seguridad';
  end if;
  if v_d.signature_path is null and not v_d.driver_confirmed then
    raise exception 'Falta la firma del chofer (o confirmar su recepción)';
  end if;

  for v_row in
    select l.item_id, sum(l.qty) as total
      from remito_dispatch_lines l
     where l.dispatch_id = v_d.id
     group by l.item_id
     order by l.item_id
  loop
    select * into v_item from remito_items where id = v_row.item_id for update;
    if v_item.quality_status <> 'aprobado' then
      raise exception 'Calidad todavía no aprobó: %', v_item.code;
    end if;
    if v_item.stock < v_row.total then
      raise exception 'Stock insuficiente de %: se piden % y hay %', v_item.code, v_row.total, v_item.stock;
    end if;
    update remito_items set stock = stock - v_row.total, updated_at = now() where id = v_row.item_id;
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

-- 4) Anular: repone el stock bloqueando los ítems en el mismo orden que confirmar (sin deadlock).
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

-- 5) Guardar borrador: mensajes claros ante datos inválidos (uuid, booleano, cantidades enormes).
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
  v_confirmed boolean;
  v_line jsonb;
  v_n int := 0;
  v_item_id uuid;
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
  v_confirmed := lower(coalesce(p_header ->> 'driver_confirmed', 'false')) in ('true', 't', '1');

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
         driver_confirmed = v_confirmed,
         updated_at = now()
   where id = v_id;

  delete from remito_dispatch_lines where dispatch_id = v_id;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    begin
      v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    exception when others then
      raise exception 'Línea %: ítem inválido', v_n;
    end;
    select * into v_item from remito_items where id = v_item_id;
    if v_item.id is null or not v_item.active then raise exception 'Línea %: el ítem no existe', v_n; end if;
    if v_item.quality_status <> 'aprobado' then
      raise exception 'Línea %: el ítem % no está aprobado por Calidad', v_n, v_item.code;
    end if;
    begin
      v_qty := (v_line ->> 'qty')::numeric;
      if v_qty > 999999999 then raise exception 'x'; end if;
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

revoke all on function public.remito_attach_file(uuid, text, text) from public, anon;
revoke all on function public.remito_set_signature(uuid, text) from public, anon;
revoke all on function public.remito_confirm_dispatch(uuid) from public, anon;
revoke all on function public.remito_cancel_dispatch(uuid, text) from public, anon;
revoke all on function public.remito_save_dispatch(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.remito_attach_file(uuid, text, text) to authenticated;
grant execute on function public.remito_set_signature(uuid, text) to authenticated;
grant execute on function public.remito_confirm_dispatch(uuid) to authenticated;
grant execute on function public.remito_cancel_dispatch(uuid, text) to authenticated;
grant execute on function public.remito_save_dispatch(uuid, jsonb, jsonb) to authenticated;
