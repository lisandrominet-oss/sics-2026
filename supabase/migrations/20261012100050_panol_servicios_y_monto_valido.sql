-- Ajustes de la revisión de 20261012100000:
-- 1) Pañol no puede subir ni borrar el remito de un servicio (los servicios los recibe solo Compras).
-- 2) submit_quotes exige un monto mayor a 0: un monto nulo hacía que technical_review se saltara a Gerencia.
-- 3) Las funciones nuevas no quedan ejecutables por anon / PUBLIC (igual que my_plant_id e is_area_member_of_plant).

create or replace function public.submit_quotes(p_sic_id uuid, p_final_amount numeric, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede enviar las cotizaciones';
  end if;
  if p_final_amount is null or p_final_amount <= 0 then
    raise exception 'El monto final es obligatorio y debe ser mayor a cero';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'cotizando' then
    raise exception 'La SIC no está en estado "cotizando"';
  end if;

  insert into sic_finance (sic_id, final_amount) values (p_sic_id, p_final_amount)
  on conflict (sic_id) do update set final_amount = excluded.final_amount, updated_at = now();

  update sics set status = 'pendiente_validacion_tecnica', updated_at = now()
  where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, 'pendiente_validacion_tecnica', p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;

create or replace function public.attach_file(p_sic_id uuid, p_file_type sic_file_type, p_storage_path text, p_file_name text, p_item_id uuid default null)
returns sic_files
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_file sic_files;
  v_requester_id uuid;
  v_status sic_status;
  v_is_service boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select requester_id, status, is_service into v_requester_id, v_status, v_is_service from sics where id = p_sic_id;
  if v_requester_id is null then raise exception 'SIC no encontrada'; end if;

  if p_item_id is not null and not exists (select 1 from sic_items where id = p_item_id and sic_id = p_sic_id) then
    raise exception 'El artículo no pertenece a esta SIC';
  end if;

  if p_file_type in ('cotizacion','comparacion','orden_compra') and v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede subir este tipo de archivo';
  end if;
  if p_file_type = 'remito' and v_role not in ('panol','compras','admin') then
    raise exception 'Solo Pañol o Compras pueden subir el remito';
  end if;
  if p_file_type = 'remito' and v_role = 'panol' and (v_status <> 'orden_emitida' or v_is_service) then
    raise exception 'Pañol solo sube el remito de bienes con orden emitida';
  end if;
  if p_file_type = 'factura' and v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede subir la factura';
  end if;
  if p_file_type = 'referencia' and v_role <> 'admin' and auth.uid() <> v_requester_id then
    raise exception 'Solo quien solicitó la SIC puede subir archivos de referencia';
  end if;
  if p_file_type = 'certificado_calidad' and v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede subir el certificado de calidad';
  end if;
  if p_file_type = 'otro' and v_role not in ('compras','admin') then
    raise exception 'Rol sin permiso para subir este archivo';
  end if;

  insert into sic_files (sic_id, uploaded_by, file_type, storage_path, file_name, item_id)
  values (p_sic_id, auth.uid(), p_file_type, p_storage_path, p_file_name, p_item_id)
  returning * into v_file;

  return v_file;
end; $function$;

create or replace function public.delete_sic_file(p_file_id uuid)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_file sic_files;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_file from sic_files where id = p_file_id;
  if v_file is null then raise exception 'Archivo no encontrado'; end if;

  select * into v_sic from sics where id = v_file.sic_id;

  if v_file.file_type in ('cotizacion','comparacion') then
    if v_role not in ('compras','admin') or v_sic.status <> 'cotizando' then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'orden_compra' then
    if v_role not in ('compras','admin') or v_sic.status <> 'aprobada' then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'remito' then
    if v_role not in ('panol','compras','admin') or v_sic.status <> 'orden_emitida'
       or (v_role = 'panol' and v_sic.is_service) then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'factura' then
    if v_sic.status not in ('orden_emitida', 'recibida') or v_role not in ('compras','admin') then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  elsif v_file.file_type = 'referencia' then
    if v_role <> 'admin' and (v_sic.requester_id is distinct from auth.uid() or v_sic.status not in ('enviada','en_observacion','pendiente_aprobacion_jefe')) then
      raise exception 'No se puede eliminar este archivo en el estado actual';
    end if;
  else
    if v_role <> 'admin' then raise exception 'No tenés permiso para eliminar este archivo'; end if;
  end if;

  delete from sic_files where id = p_file_id;
end;
$function$;

revoke execute on function public.can_read_sic_finance(uuid) from public, anon;
revoke execute on function public.can_read_sic_file(uuid, text) from public, anon;
revoke execute on function public.can_read_sic_file_path(text) from public, anon;
revoke execute on function public.is_jefe_of_plant(uuid) from public, anon;
revoke execute on function public.issue_po(uuid, text, text, boolean) from public, anon;
