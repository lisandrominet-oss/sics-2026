-- Módulo "Calidad": enganche con los módulos por usuario.
-- Parte de las definiciones VIVAS de module_default() y staff_set_user_modules() (07/11/2026) y suma solo
-- 'calidad' (por defecto admin y gerencia; el resto se habilita por usuario). No toca nada más.
-- Ojo: Remitos todavía no figura acá; cuando se enganche, partir de la definición viva, no de este archivo.

create or replace function public.module_default(p_role user_role, p_module text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
    when p_module in ('contratos', 'proveedores', 'catalogo', 'certificados') then p_role in ('compras', 'admin')
    when p_module in ('recursos-humanos', 'logistica', 'administracion', 'personal', 'roster', 'calidad') then p_role in ('admin', 'gerencia')
    else false
  end, false);
$function$;

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
  v_valid text[] := array['contratos', 'proveedores', 'catalogo', 'certificados', 'recursos-humanos', 'logistica', 'administracion', 'personal', 'roster', 'calidad'];
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
