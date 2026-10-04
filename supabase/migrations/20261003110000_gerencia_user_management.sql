-- Gestión de usuarios por Gerencia. Gerencia puede dar de alta, editar, pausar y quitar usuarios de
-- cualquier rol EXCEPTO administradores: no puede crearlos, ascender a nadie a admin ni tocar a uno.
-- Todo cambio queda en user_management_log, que solo ve el admin. Compras y el resto no tienen acceso.

create table if not exists public.user_management_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_email text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_management_log_created_idx on public.user_management_log (created_at desc);
alter table public.user_management_log enable row level security;
drop policy if exists user_management_log_admin_select on public.user_management_log;
create policy user_management_log_admin_select on public.user_management_log for select to authenticated
  using (my_role() = 'admin');

-- Gerencia ve los accesos pendientes, salvo los de administradores.
drop policy if exists user_provisioning_select_gerencia on public.user_provisioning;
create policy user_provisioning_select_gerencia on public.user_provisioning for select to authenticated
  using (my_role() = 'gerencia' and role <> 'admin');

-- ---------------------------------------------------------------- alta de acceso
create or replace function public.staff_add_user_access(
  p_email text, p_full_name text, p_role user_role, p_department text default null, p_plant_id uuid default null
)
returns user_provisioning
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor user_role;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row user_provisioning;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_actor := effective_role();
  if v_actor is null or v_actor not in ('gerencia', 'admin') then
    raise exception 'Solo Gerencia puede gestionar usuarios';
  end if;
  if v_email = '' or position('@' in v_email) < 2 then raise exception 'Mail inválido'; end if;
  if p_role is null then raise exception 'Indicá el rol'; end if;
  if v_actor <> 'admin' and p_role = 'admin' then
    raise exception 'No podés asignar el rol de administrador';
  end if;
  if p_role in ('area', 'operativo', 'panol') and p_plant_id is null then
    raise exception 'Los jefes de área, operativos y pañoleros necesitan un área asignada';
  end if;
  if exists (select 1 from profiles where lower(email) = v_email)
     or exists (select 1 from user_provisioning where email = v_email) then
    raise exception 'Ese mail ya está cargado';
  end if;

  insert into user_provisioning (email, full_name, role, department, plant_id, active)
  values (v_email, nullif(btrim(p_full_name), ''), p_role, nullif(btrim(p_department), ''), p_plant_id, true)
  returning * into v_row;

  insert into user_management_log (actor_id, action, target_email, detail)
  values (auth.uid(), 'alta_acceso', v_email, jsonb_build_object('role', p_role, 'department', p_department, 'plant_id', p_plant_id));

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- editar acceso pendiente
create or replace function public.staff_update_user_access(
  p_id uuid, p_full_name text, p_role user_role, p_department text, p_plant_id uuid, p_active boolean
)
returns user_provisioning
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor user_role;
  v_old user_provisioning;
  v_row user_provisioning;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_actor := effective_role();
  if v_actor is null or v_actor not in ('gerencia', 'admin') then
    raise exception 'Solo Gerencia puede gestionar usuarios';
  end if;

  select * into v_old from user_provisioning where id = p_id for update;
  if v_old is null then raise exception 'Acceso no encontrado'; end if;
  if p_role is null then raise exception 'Indicá el rol'; end if;
  if v_actor <> 'admin' and (v_old.role = 'admin' or p_role = 'admin') then
    raise exception 'No podés modificar ni asignar el rol de administrador';
  end if;
  if p_role in ('area', 'operativo', 'panol') and p_plant_id is null then
    raise exception 'Los jefes de área, operativos y pañoleros necesitan un área asignada';
  end if;

  update user_provisioning
  set full_name = nullif(btrim(p_full_name), ''), role = p_role, department = nullif(btrim(p_department), ''),
      plant_id = p_plant_id, active = coalesce(p_active, active)
  where id = p_id
  returning * into v_row;

  insert into user_management_log (actor_id, action, target_email, detail)
  values (auth.uid(), 'edicion_acceso', v_old.email, jsonb_build_object(
    'antes', jsonb_build_object('role', v_old.role, 'department', v_old.department, 'plant_id', v_old.plant_id, 'active', v_old.active),
    'despues', jsonb_build_object('role', v_row.role, 'department', v_row.department, 'plant_id', v_row.plant_id, 'active', v_row.active)));

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- quitar acceso pendiente
create or replace function public.staff_delete_user_access(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor user_role;
  v_old user_provisioning;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_actor := effective_role();
  if v_actor is null or v_actor not in ('gerencia', 'admin') then
    raise exception 'Solo Gerencia puede gestionar usuarios';
  end if;

  select * into v_old from user_provisioning where id = p_id for update;
  if v_old is null then raise exception 'Acceso no encontrado'; end if;
  if v_actor <> 'admin' and v_old.role = 'admin' then
    raise exception 'No podés modificar a un administrador';
  end if;

  delete from user_provisioning where id = p_id;

  insert into user_management_log (actor_id, action, target_email, detail)
  values (auth.uid(), 'baja_acceso', v_old.email, jsonb_build_object('role', v_old.role, 'department', v_old.department));
end;
$$;

-- ---------------------------------------------------------------- editar o pausar un usuario existente
create or replace function public.staff_update_user(
  p_profile_id uuid, p_role user_role, p_department text, p_plant_id uuid, p_active boolean
)
returns profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor user_role;
  v_old profiles;
  v_row profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_actor := effective_role();
  if v_actor is null or v_actor not in ('gerencia', 'admin') then
    raise exception 'Solo Gerencia puede gestionar usuarios';
  end if;

  select * into v_old from profiles where id = p_profile_id for update;
  if v_old is null then raise exception 'Usuario no encontrado'; end if;
  if p_role is null then raise exception 'Indicá el rol'; end if;

  if v_actor <> 'admin' then
    if v_old.role = 'admin' then raise exception 'No podés modificar a un administrador'; end if;
    if p_role = 'admin' then raise exception 'No podés asignar el rol de administrador'; end if;
    if v_old.id = auth.uid() and (p_role is distinct from v_old.role or p_active is distinct from v_old.active) then
      raise exception 'No podés cambiar tu propio rol ni pausarte';
    end if;
  end if;
  if p_role in ('area', 'operativo', 'panol') and p_plant_id is null then
    raise exception 'Los jefes de área, operativos y pañoleros necesitan un área asignada';
  end if;

  update profiles
  set role = p_role, department = nullif(btrim(p_department), ''), plant_id = p_plant_id, active = coalesce(p_active, active)
  where id = p_profile_id
  returning * into v_row;

  insert into user_management_log (actor_id, action, target_email, detail)
  values (auth.uid(), case when v_old.active and not v_row.active then 'pausa_usuario'
                           when not v_old.active and v_row.active then 'reactivacion_usuario'
                           else 'edicion_usuario' end,
          v_old.email, jsonb_build_object(
    'antes', jsonb_build_object('role', v_old.role, 'department', v_old.department, 'plant_id', v_old.plant_id, 'active', v_old.active),
    'despues', jsonb_build_object('role', v_row.role, 'department', v_row.department, 'plant_id', v_row.plant_id, 'active', v_row.active)));

  return v_row;
end;
$$;

revoke execute on function public.staff_add_user_access(text, text, user_role, text, uuid) from public;
revoke execute on function public.staff_add_user_access(text, text, user_role, text, uuid) from anon;
grant execute on function public.staff_add_user_access(text, text, user_role, text, uuid) to authenticated;
revoke execute on function public.staff_update_user_access(uuid, text, user_role, text, uuid, boolean) from public;
revoke execute on function public.staff_update_user_access(uuid, text, user_role, text, uuid, boolean) from anon;
grant execute on function public.staff_update_user_access(uuid, text, user_role, text, uuid, boolean) to authenticated;
revoke execute on function public.staff_delete_user_access(uuid) from public;
revoke execute on function public.staff_delete_user_access(uuid) from anon;
grant execute on function public.staff_delete_user_access(uuid) to authenticated;
revoke execute on function public.staff_update_user(uuid, user_role, text, uuid, boolean) from public;
revoke execute on function public.staff_update_user(uuid, user_role, text, uuid, boolean) from anon;
grant execute on function public.staff_update_user(uuid, user_role, text, uuid, boolean) to authenticated;
