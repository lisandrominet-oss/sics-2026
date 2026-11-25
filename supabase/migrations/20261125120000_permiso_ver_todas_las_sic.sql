-- Permiso por usuario "Ver todas las SIC" (módulo 'ver-todas-sic').
-- Quien lo tiene LEE todas las SIC de la empresa (activas e historial), con ítems, recorrido, montos,
-- archivos y el nombre del solicitante. No da ningún permiso de escritura: las RPC de acción siguen
-- validando solicitante / jefe del área / rol, así que solo actúa sobre lo que emite o le toca aprobar.
-- Nadie lo tiene por rol (module_default cae en false); el admin lo tiene siempre (has_module).
-- Aditiva: políticas SELECT nuevas + dos funciones de lectura con una condición más + clave válida.

-- ---------------------------------------------------------------- lectura de SIC, ítems y recorrido
create policy sics_select_all_module on public.sics for select to authenticated
  using ((select has_module('ver-todas-sic')));

create policy sic_items_select_all_module on public.sic_items for select to authenticated
  using ((select has_module('ver-todas-sic')));

create policy sic_events_select_all_module on public.sic_events for select to authenticated
  using ((select has_module('ver-todas-sic')));

-- Nombre del solicitante de SIC de otras áreas (solo perfiles que emitieron alguna SIC).
create policy profiles_select_ver_todas_sic on public.profiles for select to authenticated
  using (
    (select has_module('ver-todas-sic'))
    and exists (select 1 from public.sics s where s.requester_id = profiles.id)
  );

-- ---------------------------------------------------------------- montos
create or replace function public.can_read_sic_finance(p_sic_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sic record;
begin
  if auth.uid() is null then return false; end if;
  if my_role() in ('admin', 'compras', 'gerencia') then return true; end if;
  if has_module('ver-todas-sic') then return true; end if;
  select requester_id, plant_id, status into v_sic from sics where id = p_sic_id;
  if not found then return false; end if;
  if is_jefe_of_plant(v_sic.plant_id) then return true; end if;
  return v_sic.requester_id = auth.uid() and v_sic.status = 'pendiente_validacion_tecnica';
end;
$function$;

-- ---------------------------------------------------------------- archivos (todos los tipos: incluye cotizaciones y OC)
create or replace function public.can_read_sic_file(p_sic_id uuid, p_file_type text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_sic record;
begin
  if auth.uid() is null then return false; end if;
  v_role := my_role();
  if v_role in ('admin', 'compras', 'gerencia') then return true; end if;
  if has_module('ver-todas-sic') then return true; end if;
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
$function$;

-- ---------------------------------------------------------------- clave válida al asignar módulos
create or replace function public.staff_set_user_modules(p_profile_id uuid, p_overrides jsonb)
 returns profiles
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor user_role;
  v_old profiles;
  v_row profiles;
  v_valid text[] := array['contratos', 'proveedores', 'catalogo', 'certificados', 'recursos-humanos', 'logistica', 'administracion', 'personal', 'roster', 'calidad', 'ver-todas-sic'];
  v_key text;
  v_val jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_actor := effective_role();
  if v_actor is null or v_actor not in ('gerencia', 'admin') then
    raise exception 'Solo Gerencia puede gestionar los módulos de un usuario';
  end if;
  if p_overrides is null or jsonb_typeof(p_overrides) <> 'object' then
    raise exception 'Formato de módulos inválido';
  end if;
  for v_key, v_val in select * from jsonb_each(p_overrides) loop
    if not (v_key = any (v_valid)) then raise exception 'Módulo desconocido: %', v_key; end if;
    if jsonb_typeof(v_val) <> 'boolean' then raise exception 'El módulo % debe ser verdadero o falso', v_key; end if;
  end loop;

  select * into v_old from profiles where id = p_profile_id for update;
  if v_old.id is null then raise exception 'Usuario no encontrado'; end if;
  if v_old.role is null then raise exception 'El usuario todavía no tiene rol'; end if;
  if v_old.role = 'admin' then raise exception 'Los administradores siempre tienen todos los módulos'; end if;
  if v_actor <> 'admin' and v_old.id = auth.uid() then
    raise exception 'No podés cambiar tus propios módulos';
  end if;

  update profiles set module_overrides = p_overrides where id = p_profile_id returning * into v_row;

  insert into user_management_log (actor_id, action, target_email, detail)
  values (auth.uid(), 'edicion_modulos', v_old.email,
          jsonb_build_object('antes', v_old.module_overrides, 'despues', v_row.module_overrides));

  return v_row;
end;
$function$;
