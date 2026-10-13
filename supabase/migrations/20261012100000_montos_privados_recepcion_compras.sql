-- Montos privados + Pañol solo recepción + Compras recibe (servicios)
--
-- 1) El dinero sale de `sics` y pasa a `sic_finance`, con RLS por rol. La RLS filtra filas, no
--    columnas, y todos los usuarios comparten el rol Postgres `authenticated`: no hay otra forma
--    robusta de ocultar el monto a taller y pañol.
-- 2) Archivos con precios (cotización, comparación, OC, factura, otro) legibles solo por
--    Compras, Gerencia, admin y jefe de la planta. El solicitante operativo ve cotización y
--    comparación únicamente mientras la SIC está en validación técnica.
-- 3) Pañol = recepción: no emite SIC; ve solo SIC con orden emitida en adelante (sin servicios),
--    y de ellas solo remito, referencias y certificados.
-- 4) Servicios (`is_service`): los marca Compras al emitir la OC. Compras puede recibir cualquier
--    compra y subir el remito. La factura la sube solo Compras.
-- 5) Las notas del recorrido dejan de llevar monto y proveedor.
--
-- Esta migración NO elimina sics.final_amount / estimated_amount: eso va en la siguiente, una vez
-- verificado todo. Las notas históricas con monto/proveedor se limpian en otra migración aparte.
--
-- Snapshot de las funciones vivas que solo existían en la base (para no perder el cuerpo previo):
-- issue_po, attach_file, delete_sic_file, record_delivery, technical_review, submit_quotes,
-- close_sic, classify_sic_direct, classify_sic_current_account, set_sic_current_account_amount,
-- revert_sic_to_normal, create_sic, get_pending_notifications. Se reemplazan más abajo.

------------------------------------------------------------------------------
-- 0. Columna is_service y tabla sic_finance
------------------------------------------------------------------------------
alter table public.sics add column if not exists is_service boolean not null default false;

create table if not exists public.sic_finance (
  sic_id uuid primary key references public.sics(id) on delete cascade,
  final_amount numeric,
  updated_at timestamptz not null default now()
);
alter table public.sic_finance enable row level security;

insert into public.sic_finance (sic_id, final_amount)
select id, final_amount from public.sics where final_amount is not null
on conflict (sic_id) do nothing;

------------------------------------------------------------------------------
-- 1. Helpers de permiso
------------------------------------------------------------------------------
-- Jefe de área (rol 'area') de la planta. is_area_member_of_plant mezcla area y operativo.
create or replace function public.is_jefe_of_plant(p_plant_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    p_plant_id is not null
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.active and p.role = 'area' and p.plant_id = p_plant_id
    ),
    false
  );
$$;

-- Quién ve el monto de una SIC.
create or replace function public.can_read_sic_finance(p_sic_id uuid)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_sic record;
begin
  if auth.uid() is null then return false; end if;
  if my_role() in ('admin', 'compras', 'gerencia') then return true; end if;
  select requester_id, plant_id, status into v_sic from sics where id = p_sic_id;
  if not found then return false; end if;
  if is_jefe_of_plant(v_sic.plant_id) then return true; end if;
  -- El solicitante ve el monto solo mientras valida lo cotizado.
  return v_sic.requester_id = auth.uid() and v_sic.status = 'pendiente_validacion_tecnica';
end;
$$;

-- Quién ve un archivo de una SIC según su tipo.
-- Tipos con precios: cotizacion, comparacion, orden_compra, factura, otro.
create or replace function public.can_read_sic_file(p_sic_id uuid, p_file_type text)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_role user_role;
  v_sic record;
begin
  if auth.uid() is null then return false; end if;
  v_role := my_role();
  if v_role in ('admin', 'compras', 'gerencia') then return true; end if;
  select requester_id, plant_id, status, is_service into v_sic from sics where id = p_sic_id;
  if not found then return false; end if;
  if is_jefe_of_plant(v_sic.plant_id) then return true; end if;
  if v_role = 'panol' then
    return p_file_type in ('remito', 'referencia', 'certificado_calidad')
      and not v_sic.is_service
      and v_sic.status in ('orden_emitida', 'recibida', 'cerrada');
  end if;
  if p_file_type not in ('cotizacion', 'comparacion', 'orden_compra', 'factura', 'otro') then
    return v_sic.requester_id = auth.uid() or is_area_member_of_plant(v_sic.plant_id);
  end if;
  return v_sic.requester_id = auth.uid()
    and p_file_type in ('cotizacion', 'comparacion')
    and v_sic.status = 'pendiente_validacion_tecnica';
end;
$$;

-- Ruta del bucket sic-files: {sic_id}/{tipo}/{archivo}
create or replace function public.can_read_sic_file_path(p_name text)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_parts text[] := storage.foldername(p_name);
begin
  if array_length(v_parts, 1) is null or array_length(v_parts, 1) < 2 then return false; end if;
  if v_parts[1] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return can_read_sic_file(v_parts[1]::uuid, v_parts[2]);
end;
$$;

------------------------------------------------------------------------------
-- 2. Políticas
------------------------------------------------------------------------------
create policy sic_finance_select on public.sic_finance
  for select using (public.can_read_sic_finance(sic_id));
create policy sic_finance_admin_write on public.sic_finance
  for all using (public.my_role() = 'admin'::user_role) with check (public.my_role() = 'admin'::user_role);

-- sics: Pañol sale del acceso general; ve solo desde orden emitida, sin servicios.
drop policy if exists sics_select_staff on public.sics;
create policy sics_select_staff on public.sics
  for select using (public.my_role() = any (array['admin'::user_role, 'compras'::user_role, 'gerencia'::user_role]));
create policy sics_select_panol on public.sics
  for select using (
    public.my_role() = 'panol'::user_role
    and not is_service
    and status in ('orden_emitida', 'recibida', 'cerrada')
  );

-- sic_items
drop policy if exists sic_items_select on public.sic_items;
create policy sic_items_select on public.sic_items
  for select using (exists (
    select 1 from public.sics s
    where s.id = sic_items.sic_id
      and (public.my_role() = any (array['admin'::user_role, 'compras'::user_role, 'gerencia'::user_role])
           or s.requester_id = auth.uid())
  ));
create policy sic_items_select_panol on public.sic_items
  for select using (
    public.my_role() = 'panol'::user_role
    and exists (
      select 1 from public.sics s
      where s.id = sic_items.sic_id and not s.is_service
        and s.status in ('orden_emitida', 'recibida', 'cerrada')
    )
  );

-- sic_events
drop policy if exists sic_events_select on public.sic_events;
create policy sic_events_select on public.sic_events
  for select using (exists (
    select 1 from public.sics s
    where s.id = sic_events.sic_id
      and (public.my_role() = any (array['admin'::user_role, 'compras'::user_role, 'gerencia'::user_role])
           or s.requester_id = auth.uid())
  ));
create policy sic_events_select_panol on public.sic_events
  for select using (
    public.my_role() = 'panol'::user_role
    and exists (
      select 1 from public.sics s
      where s.id = sic_events.sic_id and not s.is_service
        and s.status in ('orden_emitida', 'recibida', 'cerrada')
    )
  );

-- sic_files: una sola política de lectura, por tipo de archivo.
drop policy if exists sic_files_select on public.sic_files;
drop policy if exists sic_files_select_area on public.sic_files;
create policy sic_files_select on public.sic_files
  for select using (public.can_read_sic_file(sic_id, file_type::text));

-- Storage del bucket sic-files: misma regla, por la carpeta del tipo.
drop policy if exists sic_files_storage_select on storage.objects;
create policy sic_files_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'sic-files' and public.can_read_sic_file_path(name));

-- app_settings: el tope de Gerencia no lo necesita ver el taller.
drop policy if exists app_settings_select_all on public.app_settings;
create policy app_settings_select_staff on public.app_settings
  for select using (public.my_role() = any (array['admin'::user_role, 'compras'::user_role, 'gerencia'::user_role]));

------------------------------------------------------------------------------
-- 3. RPC que tocan el monto (ahora en sic_finance) y notas sin monto ni proveedor
------------------------------------------------------------------------------
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

create or replace function public.technical_review(p_sic_id uuid, p_aprobar boolean, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_sic sics;
  v_new_status sic_status;
  v_threshold numeric;
  v_amount numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'pendiente_validacion_tecnica' then
    raise exception 'La SIC no está pendiente de validación técnica';
  end if;
  if v_role <> 'admin' and v_sic.requester_id is distinct from v_uid then
    if v_role <> 'area' or not exists (
      select 1 from profiles p where p.id = v_uid and p.active and p.plant_id = v_sic.plant_id
    ) then
      raise exception 'Solo quien emitió la SIC o un jefe de su área puede validarla técnicamente';
    end if;
  end if;

  if not p_aprobar then
    v_new_status := 'cotizando';
  else
    if v_sic.currency = 'ARS' then
      select (value #>> '{}')::numeric into v_threshold from app_settings where key = 'gerencia_approval_threshold_ars';
      select final_amount into v_amount from sic_finance where sic_id = p_sic_id;
      if v_amount is not null and v_amount > coalesce(v_threshold, 500000) then
        v_new_status := 'pendiente_aprobacion_gerencia';
      else
        v_new_status := 'aprobada';
      end if;
    else
      v_new_status := 'pendiente_aprobacion_gerencia';
    end if;
  end if;

  update sics set status = v_new_status, updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, v_uid, v_sic.status, v_new_status, p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;

create or replace function public.classify_sic_current_account(p_sic_id uuid, p_provider_id uuid, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic sics;
  v_provider providers;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede clasificar una SIC como cuenta corriente';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status not in ('enviada', 'cotizando') then
    raise exception 'Solo se puede clasificar una SIC enviada o en cotización';
  end if;

  select * into v_provider from providers where id = p_provider_id;
  if v_provider is null then raise exception 'Proveedor no encontrado'; end if;
  if not v_provider.active then raise exception 'El proveedor está archivado'; end if;
  if not v_provider.has_current_account then
    raise exception 'El proveedor no tiene cuenta corriente habilitada';
  end if;

  update sics
  set purchase_type = 'cuenta_corriente', provider_id = p_provider_id, status = 'aprobada', updated_at = now()
  where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'aprobada',
    'Clasificada como cuenta corriente'
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $function$;

create or replace function public.classify_sic_direct(p_sic_id uuid, p_amount numeric, p_provider_id uuid default null, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic sics;
  v_provider providers;
  v_new_status sic_status;
  v_threshold numeric;
  v_event_note text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede clasificar una SIC como compra directa';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto de la compra directa es obligatorio';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status not in ('enviada', 'cotizando') then
    raise exception 'Solo se puede clasificar una SIC enviada o en cotización';
  end if;

  if p_provider_id is not null then
    select * into v_provider from providers where id = p_provider_id;
    if v_provider is null then raise exception 'Proveedor no encontrado'; end if;
    if not v_provider.active then raise exception 'El proveedor está archivado'; end if;
  end if;

  if v_sic.currency = 'ARS' then
    select (value #>> '{}')::numeric into v_threshold from app_settings where key = 'gerencia_approval_threshold_ars';
    if p_amount > coalesce(v_threshold, 500000) then
      v_new_status := 'pendiente_aprobacion_gerencia';
    else
      v_new_status := 'aprobada';
    end if;
  else
    v_new_status := 'pendiente_aprobacion_gerencia';
  end if;

  update sics
  set purchase_type = 'directa', provider_id = p_provider_id,
      status = v_new_status, updated_at = now()
  where id = p_sic_id;

  insert into sic_finance (sic_id, final_amount) values (p_sic_id, p_amount)
  on conflict (sic_id) do update set final_amount = excluded.final_amount, updated_at = now();

  v_event_note := 'Clasificada como compra directa'
    || case when v_new_status = 'pendiente_aprobacion_gerencia' then '. Pasa a Gerencia' else '' end
    || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, v_new_status, v_event_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;

create or replace function public.revert_sic_to_normal(p_sic_id uuid, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic sics;
  v_label text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede reclasificar una SIC';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.purchase_type not in ('cuenta_corriente', 'directa') or v_sic.status <> 'aprobada' then
    raise exception 'Solo se puede volver a compra normal antes de emitir la orden de compra';
  end if;

  v_label := case when v_sic.purchase_type = 'directa' then 'compra directa' else 'cuenta corriente' end;

  update sics
  set purchase_type = 'normal', provider_id = null, status = 'cotizando', updated_at = now()
  where id = p_sic_id;

  if v_sic.purchase_type = 'directa' then
    delete from sic_finance where sic_id = p_sic_id;
  end if;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'cotizando',
    'Reclasificada como compra normal (era ' || v_label || ')'
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end;
$function$;

create or replace function public.set_sic_current_account_amount(p_sic_id uuid, p_amount numeric, p_note text default null)
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
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede cargar el monto';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Monto inválido'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.purchase_type <> 'cuenta_corriente' then
    raise exception 'La SIC no es de cuenta corriente';
  end if;
  if v_sic.status not in ('orden_emitida', 'recibida') then
    raise exception 'El monto se carga con la orden emitida o recibida';
  end if;

  insert into sic_finance (sic_id, final_amount) values (p_sic_id, p_amount)
  on conflict (sic_id) do update set final_amount = excluded.final_amount, updated_at = now();
  update sics set updated_at = now() where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, v_sic.status,
    'Monto cargado'
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $function$;

create or replace function public.close_sic(p_sic_id uuid, p_note text default null)
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
    raise exception 'Solo Compras puede cerrar la SIC';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'recibida' then
    raise exception 'La SIC no está en estado "recibida"';
  end if;

  if v_sic.purchase_type = 'cuenta_corriente' then
    if not exists (select 1 from sic_finance where sic_id = p_sic_id and final_amount is not null) then
      raise exception 'Cargá el monto de la compra antes de cerrar la SIC';
    end if;
  elsif not exists (select 1 from sic_files where sic_id = p_sic_id and file_type = 'factura') then
    raise exception 'Debe subir la factura antes de cerrar la SIC';
  end if;

  update sics set status = 'cerrada', updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, 'cerrada', p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $function$;

------------------------------------------------------------------------------
-- 4. Servicios y recepción
------------------------------------------------------------------------------
drop function if exists public.issue_po(uuid, text, text);
create or replace function public.issue_po(p_sic_id uuid, p_po_number text default null, p_note text default null, p_is_service boolean default false)
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
    raise exception 'Solo Compras puede emitir la orden de compra';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'aprobada' then
    raise exception 'La SIC no está aprobada';
  end if;

  update sics
  set status = 'orden_emitida', po_number = coalesce(p_po_number, po_number),
      is_service = coalesce(p_is_service, false), updated_at = now()
  where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'orden_emitida',
    coalesce(
      p_note,
      case when coalesce(p_is_service, false) then 'Es un servicio: la recepción la registra Compras' end
    )
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $function$;

create or replace function public.record_delivery(p_sic_id uuid, p_deliveries jsonb, p_note text default null)
returns sics
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic sics;
  v_item jsonb;
  v_all_complete boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('panol','compras','admin') then
    raise exception 'Solo Pañol o Compras pueden registrar la recepción';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'orden_emitida' then
    raise exception 'La SIC no está en estado "orden emitida"';
  end if;
  if v_role = 'panol' and v_sic.is_service then
    raise exception 'Los servicios los recibe Compras';
  end if;
  if not exists (select 1 from sic_files where sic_id = p_sic_id and file_type = 'remito') then
    raise exception 'Debe subir al menos un remito antes de registrar la recepción';
  end if;

  if v_sic.is_service then
    -- Un servicio no se cuenta por cantidades: se da por recibido completo.
    update sic_items set received_quantity = quantity
    where sic_id = p_sic_id and review_status = 'activo';
    update sics set status = 'recibida', updated_at = now() where id = p_sic_id;
    insert into sic_events (sic_id, actor_id, from_status, to_status, note)
    values (p_sic_id, auth.uid(), 'orden_emitida', 'recibida', coalesce(p_note, 'Servicio recibido'));
  else
    for v_item in select * from jsonb_array_elements(p_deliveries)
    loop
      update sic_items
      set received_quantity = least(quantity, received_quantity + (v_item->>'quantity_received')::numeric)
      where id = (v_item->>'item_id')::uuid and sic_id = p_sic_id and review_status = 'activo';
    end loop;

    select bool_and(received_quantity >= quantity) into v_all_complete
    from sic_items where sic_id = p_sic_id and review_status = 'activo';

    if v_all_complete then
      update sics set status = 'recibida', updated_at = now() where id = p_sic_id;
      insert into sic_events (sic_id, actor_id, from_status, to_status, note)
      values (p_sic_id, auth.uid(), 'orden_emitida', 'recibida', coalesce(p_note, 'Recepción completa'));
    else
      update sics set updated_at = now() where id = p_sic_id;
      insert into sic_events (sic_id, actor_id, from_status, to_status, note)
      values (p_sic_id, auth.uid(), 'orden_emitida', 'orden_emitida', coalesce(p_note, 'Recepción parcial registrada'));
    end if;
  end if;

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $function$;

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
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null then raise exception 'Usuario no habilitado'; end if;

  select requester_id, status into v_requester_id, v_status from sics where id = p_sic_id;
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
  if p_file_type = 'remito' and v_role = 'panol' and v_status <> 'orden_emitida' then
    raise exception 'Pañol solo sube el remito de una SIC con orden emitida';
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
    if v_role not in ('panol','compras','admin') or v_sic.status <> 'orden_emitida' then
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

------------------------------------------------------------------------------
-- 5. Pañol no emite SIC; avisos de recepción
------------------------------------------------------------------------------
create or replace function public.create_sic(p_subject text, p_project_id uuid, p_needed_by_date date, p_currency currency_code default 'ARS'::currency_code, p_plant_id uuid default null::uuid, p_items jsonb default '[]'::jsonb, p_on_behalf_of text default null::text)
returns sics
language plpgsql security definer
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

create or replace function public.get_pending_notifications(p_limit integer default 20)
returns table(id uuid, code text, subject text, status sic_status, updated_at timestamp with time zone)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_plant uuid;
begin
  if v_uid is null then
    return;
  end if;

  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'gerencia', 'panol', 'area', 'operativo') then
    return;
  end if;
  select p.plant_id into v_plant from profiles p where p.id = v_uid;

  return query
    select s.id, s.code, s.subject, s.status, s.updated_at
    from sics s
    left join notification_reads r on r.sic_id = s.id and r.profile_id = v_uid
    where (r.read_at is null or r.read_at < s.updated_at)
      and (
        (v_role = 'compras' and (
              s.status = any(array['enviada','cotizando','aprobada','recibida']::sic_status[])
              or (s.status = 'orden_emitida' and s.is_service)
            ))
        or (v_role = 'gerencia' and s.status = 'pendiente_aprobacion_gerencia')
        or (v_role = 'panol' and s.status = 'orden_emitida' and not s.is_service)
        or (v_role = 'area' and (
              (s.status = 'pendiente_aprobacion_jefe' and s.plant_id = v_plant)
              or (s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
            ))
        or (v_role = 'operativo' and s.status = any(array['pendiente_validacion_tecnica','en_observacion']::sic_status[]) and s.requester_id = v_uid)
      )
    order by s.updated_at desc
    limit p_limit;
end;
$function$;
