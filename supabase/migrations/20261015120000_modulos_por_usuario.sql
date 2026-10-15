-- Módulos habilitables por usuario. Cada rol arranca con los módulos de siempre (module_default) y
-- admin/gerencia pueden sumar o quitar módulos a un usuario puntual (profiles.module_overrides).
-- Módulos: contratos, proveedores, catalogo, certificados, recursos-humanos, logistica, administracion.
-- Admin siempre tiene todos. El circuito de SIC sigue yendo por rol (no pasa por módulos).

alter table public.profiles add column if not exists module_overrides jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------- defaults por rol
create or replace function public.module_default(p_role user_role, p_module text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(case
    when p_module in ('contratos', 'proveedores', 'catalogo', 'certificados') then p_role in ('compras', 'admin')
    when p_module in ('recursos-humanos', 'logistica', 'administracion') then p_role in ('admin', 'gerencia')
    else false
  end, false);
$$;

-- ---------------------------------------------------------------- ¿el usuario tiene el módulo?
-- p_effective = false: rol real (para RLS, igual que my_role()).
-- p_effective = true: respeta "Ver como" (para RPC, igual que effective_role()); un admin simulando otro
-- rol ve los módulos por defecto de ese rol.
create or replace function public.has_module(p_module text, p_effective boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_p profiles;
  v_ov jsonb;
begin
  select * into v_p from profiles where id = auth.uid() and active;
  if v_p.id is null or v_p.role is null then return false; end if;

  if p_effective and v_p.role = 'admin' and v_p.acting_as_role is not null then
    return module_default(v_p.acting_as_role, p_module);
  end if;
  if v_p.role = 'admin' then return true; end if;

  v_ov := v_p.module_overrides -> p_module;
  if v_ov is not null and jsonb_typeof(v_ov) = 'boolean' then
    return (v_ov #>> '{}')::boolean;
  end if;
  return module_default(v_p.role, p_module);
end;
$$;

revoke execute on function public.has_module(text, boolean) from public;
revoke execute on function public.has_module(text, boolean) from anon;
grant execute on function public.has_module(text, boolean) to authenticated;
revoke execute on function public.module_default(user_role, text) from public;
revoke execute on function public.module_default(user_role, text) from anon;
grant execute on function public.module_default(user_role, text) to authenticated;

-- ---------------------------------------------------------------- políticas RLS
do $$
declare
  t text;
begin
  -- Contratos (incluye las facturas de proveedor, que se cargan contra contratos).
  foreach t in array array[
    'contracts', 'contract_items', 'contract_item_rates', 'contract_usage', 'contract_installments',
    'contract_documents', 'contract_events', 'contract_alerts', 'provider_invoices', 'provider_invoice_lines'
  ] loop
    execute format(
      'alter policy %I on public.%I using ((select has_module(%L))) with check ((select has_module(%L)))',
      t || '_staff_all', t, 'contratos', 'contratos');
  end loop;

  -- Proveedores.
  foreach t in array array['providers', 'provider_categories', 'provider_category_links', 'provider_comments', 'provider_files'] loop
    execute format(
      'alter policy %I on public.%I using ((select has_module(%L))) with check ((select has_module(%L)))',
      t || '_staff_all', t, 'proveedores', 'proveedores');
  end loop;
end $$;

-- Los contratos muestran el nombre del proveedor: con Contratos se puede leer (no escribir) la ficha.
drop policy if exists providers_select_contratos on public.providers;
create policy providers_select_contratos on public.providers for select to authenticated
  using ((select has_module('contratos')));

-- Con Contratos se ve el nombre de quien es responsable de un contrato o actuó en su historial
-- (profiles solo la leen admin, compras, gerencia y pañol).
drop policy if exists profiles_select_contratos on public.profiles;
create policy profiles_select_contratos on public.profiles for select to authenticated
  using (
    (select has_module('contratos'))
    and (
      exists (select 1 from public.contracts c where c.owner_id = profiles.id)
      or exists (select 1 from public.contract_events e where e.actor_id = profiles.id)
    )
  );

alter policy item_catalog_staff_write on public.item_catalog
  using ((select has_module('catalogo'))) with check ((select has_module('catalogo')));

alter policy contract_files_storage_all on storage.objects
  using (bucket_id = 'contract-files' and (select has_module('contratos')))
  with check (bucket_id = 'contract-files' and (select has_module('contratos')));
alter policy provider_files_storage_all on storage.objects
  using (bucket_id = 'provider-files' and (select has_module('proveedores')))
  with check (bucket_id = 'provider-files' and (select has_module('proveedores')));

-- ---------------------------------------------------------------- RPC: mismo cuerpo, nuevo chequeo
-- Se toma la definición vigente en la base y se reemplaza solo la línea del chequeo de rol.
-- Si una función no tiene exactamente esa línea, la migración falla en vez de dejarla a medias.
do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select * from (values
      ('accept_installment_difference', 'contratos'), ('add_contract_item_rate', 'contratos'),
      ('create_contract', 'contratos'), ('update_contract', 'contratos'), ('renew_contract', 'contratos'),
      ('return_contract', 'contratos'), ('record_contract_usage', 'contratos'),
      ('record_provider_invoice', 'contratos'), ('update_provider_invoice', 'contratos'),
      ('void_provider_invoice', 'contratos'), ('set_contract_alert_attended', 'contratos'),
      ('update_contract_item', 'contratos'), ('set_contract_item_internal_number', 'contratos'),
      ('get_pending_quality_certificates', 'certificados')
    ) as f(fname, modulo)
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fname;
    v_new := regexp_replace(
      v_def,
      'if v_role is null or v_role not in \(''compras'',\s*''admin''\) then',
      format('if not has_module(%L, true) then', r.modulo));
    if v_new = v_def then raise exception 'No se encontró el chequeo de rol en %', r.fname; end if;
    execute v_new;
  end loop;

  for r in select * from (values ('catalog_save'), ('catalog_set_active')) as f(fname) loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fname;
    v_new := regexp_replace(
      v_def,
      'if effective_role\(\) is null or effective_role\(\) not in \(''compras'',\s*''admin''\) then',
      'if not has_module(''catalogo'', true) then');
    if v_new = v_def then raise exception 'No se encontró el chequeo de rol en %', r.fname; end if;
    execute v_new;
  end loop;
end $$;

-- ---------------------------------------------------------------- admin y gerencia editan los módulos
-- p_overrides: {"<modulo>": true|false}. Lo que no figura sigue el default del rol.
create or replace function public.staff_set_user_modules(p_profile_id uuid, p_overrides jsonb)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor user_role;
  v_old profiles;
  v_row profiles;
  v_valid text[] := array['contratos', 'proveedores', 'catalogo', 'certificados', 'recursos-humanos', 'logistica', 'administracion'];
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
$$;

revoke execute on function public.staff_set_user_modules(uuid, jsonb) from public;
revoke execute on function public.staff_set_user_modules(uuid, jsonb) from anon;
grant execute on function public.staff_set_user_modules(uuid, jsonb) to authenticated;
