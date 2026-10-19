-- Módulo "Personal": legajo base de todos los empleados de la empresa (no solo de quienes rotan).
-- Los empleados NO son usuarios del sistema: profiles son los administrativos con login; employees es la
-- base de personas. El vínculo con profiles es opcional (para quien además tenga login).
-- Habilitable por usuario con el sistema de módulos (clave 'personal'; admin y gerencia por defecto).
-- Las tablas solo se leen por RLS (has_module('personal')) y se escriben únicamente por RPC; no hay
-- borrado: la baja es lógica (estado + fecha) y todo cambio queda en employee_events.
-- Datos personales reales NO van en esta migración ni en el repo.

-- ---------------------------------------------------------------- módulo 'personal'
create or replace function public.module_default(p_role user_role, p_module text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(case
    when p_module in ('contratos', 'proveedores', 'catalogo', 'certificados') then p_role in ('compras', 'admin')
    when p_module in ('recursos-humanos', 'logistica', 'administracion', 'personal') then p_role in ('admin', 'gerencia')
    else false
  end, false);
$$;

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
  v_valid text[] := array['contratos', 'proveedores', 'catalogo', 'certificados', 'recursos-humanos', 'logistica', 'administracion', 'personal'];
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

-- ---------------------------------------------------------------- tablas
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  legajo text,
  last_name text not null,
  first_name text not null,
  dni text not null,
  cuil text,
  birth_date date,
  hire_date date,
  termination_date date,
  status text not null default 'activo',
  position text,
  job_category text,
  plant_id uuid references public.plants(id),
  profile_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_status_check check (status in ('activo', 'licencia', 'baja')),
  constraint employees_dni_check check (dni ~ '^[0-9]{6,8}$'),
  constraint employees_cuil_check check (cuil is null or cuil ~ '^[0-9]{11}$'),
  constraint employees_baja_check check ((status = 'baja') = (termination_date is not null)),
  constraint employees_dates_check check (termination_date is null or hire_date is null or termination_date >= hire_date)
);

create unique index employees_dni_key on public.employees (dni);
create unique index employees_legajo_key on public.employees (lower(legajo)) where legajo is not null;
create unique index employees_profile_key on public.employees (profile_id) where profile_id is not null;
create index employees_status_idx on public.employees (status);
create index employees_plant_idx on public.employees (plant_id);
create index employees_name_idx on public.employees (lower(last_name), lower(first_name));

-- Auditoría. employee_id es nulo en las exportaciones (afectan a un listado, no a una persona).
create table public.employee_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('alta', 'edicion', 'baja', 'reactivacion', 'licencia', 'fin_licencia', 'exportacion')),
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index employee_events_employee_idx on public.employee_events (employee_id, created_at desc);
create index employee_events_actor_idx on public.employee_events (actor_id);

-- ---------------------------------------------------------------- RLS: solo lectura directa
alter table public.employees enable row level security;
alter table public.employee_events enable row level security;

create policy employees_staff_select on public.employees for select to authenticated
  using ((select has_module('personal')));
create policy employee_events_staff_select on public.employee_events for select to authenticated
  using ((select has_module('personal')));

-- Con Personal se ve el nombre de quien actuó en un legajo o está vinculado a un empleado
-- (profiles solo la leen admin, compras, gerencia y pañol).
drop policy if exists profiles_select_personal on public.profiles;
create policy profiles_select_personal on public.profiles for select to authenticated
  using (
    (select has_module('personal'))
    and (
      exists (select 1 from public.employee_events e where e.actor_id = profiles.id)
      or exists (select 1 from public.employees m where m.profile_id = profiles.id)
    )
  );

-- ---------------------------------------------------------------- validaciones internas
-- CUIL/CUIT: 11 dígitos, prefijo de persona y dígito verificador (módulo 11).
create or replace function public.is_valid_cuil(p_cuil text)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  w int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  s int := 0;
  i int;
  r int;
  dv int;
begin
  if p_cuil is null or p_cuil !~ '^[0-9]{11}$' then return false; end if;
  if substr(p_cuil, 1, 2) not in ('20', '23', '24', '25', '26', '27') then return false; end if;
  for i in 1..10 loop
    s := s + substr(p_cuil, i, 1)::int * w[i];
  end loop;
  r := s % 11;
  if r = 0 then
    dv := 0;
  elsif r = 1 then
    -- Caso especial: prefijo 23 con dígito 9 (varón) o 4 (mujer).
    return substr(p_cuil, 1, 2) = '23' and substr(p_cuil, 11, 1) in ('9', '4');
  else
    dv := 11 - r;
  end if;
  return substr(p_cuil, 11, 1)::int = dv;
end;
$function$;

-- El CUIL lleva el DNI adentro (posiciones 3 a 10): si no coinciden, hay un error de tipeo.
create or replace function public.employee_check_cuil(p_dni text, p_cuil text)
returns void
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_cuil is null then return; end if;
  if not is_valid_cuil(p_cuil) then raise exception 'CUIL inválido: %', p_cuil; end if;
  if p_dni is not null and substr(p_cuil, 3, 8) <> lpad(p_dni, 8, '0') then
    raise exception 'El CUIL % no coincide con el DNI %', p_cuil, p_dni;
  end if;
end;
$function$;

-- Normaliza y valida los campos que vengan en p_data (solo las claves presentes). Vacío = null.
-- No chequea obligatorios ni duplicados: eso lo hace cada RPC.
create or replace function public.employee_clean(p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v jsonb := '{}'::jsonb;
  k text;
  t text;
  d date;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Datos del empleado inválidos';
  end if;

  foreach k in array array['legajo', 'last_name', 'first_name', 'position', 'job_category'] loop
    if p_data ? k then
      t := nullif(regexp_replace(btrim(coalesce(p_data ->> k, '')), '\s+', ' ', 'g'), '');
      if t is not null and length(t) > 120 then raise exception 'El campo % es demasiado largo', k; end if;
      v := v || jsonb_build_object(k, t);
    end if;
  end loop;

  if p_data ? 'dni' then
    t := nullif(regexp_replace(coalesce(p_data ->> 'dni', ''), '\D', '', 'g'), '');
    if t is not null then t := nullif(ltrim(t, '0'), ''); end if;
    if t is not null and t !~ '^[0-9]{6,8}$' then raise exception 'DNI inválido: debe tener entre 6 y 8 dígitos'; end if;
    v := v || jsonb_build_object('dni', t);
  end if;

  if p_data ? 'cuil' then
    t := nullif(regexp_replace(coalesce(p_data ->> 'cuil', ''), '\D', '', 'g'), '');
    if t is not null and not is_valid_cuil(t) then raise exception 'CUIL inválido: %', t; end if;
    v := v || jsonb_build_object('cuil', t);
  end if;

  foreach k in array array['birth_date', 'hire_date'] loop
    if p_data ? k then
      t := nullif(btrim(coalesce(p_data ->> k, '')), '');
      d := null;
      if t is not null then
        -- Solo ISO (AAAA-MM-DD): otro formato se interpretaría según el DateStyle del servidor.
        if t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          raise exception 'Fecha inválida en %: %. Usá el formato AAAA-MM-DD', k, t;
        end if;
        begin
          d := t::date;
        exception when others then
          raise exception 'Fecha inválida en %: %', k, t;
        end;
        if k = 'birth_date' and (d < date '1930-01-01' or d > current_date - interval '14 years') then
          raise exception 'Fecha de nacimiento fuera de rango: %', t;
        end if;
        if k = 'hire_date' and (d < date '1950-01-01' or d > current_date + interval '1 year') then
          raise exception 'Fecha de ingreso fuera de rango: %', t;
        end if;
      end if;
      v := v || jsonb_build_object(k, d);
    end if;
  end loop;

  if p_data ? 'plant_id' then
    t := nullif(btrim(coalesce(p_data ->> 'plant_id', '')), '');
    if t is not null and not exists (select 1 from plants where id = t::uuid) then
      raise exception 'El área indicada no existe';
    end if;
    v := v || jsonb_build_object('plant_id', t);
  end if;

  if p_data ? 'profile_id' then
    t := nullif(btrim(coalesce(p_data ->> 'profile_id', '')), '');
    if t is not null and not exists (select 1 from profiles where id = t::uuid) then
      raise exception 'El usuario indicado no existe';
    end if;
    v := v || jsonb_build_object('profile_id', t);
  end if;

  return v;
end;
$function$;

revoke execute on function public.is_valid_cuil(text) from public, anon, authenticated;
revoke execute on function public.employee_check_cuil(text, text) from public, anon, authenticated;
revoke execute on function public.employee_clean(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPC
create or replace function public.create_employee(p_data jsonb)
returns employees
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c jsonb;
  v_row employees;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('personal', true) then
    raise exception 'Sin permiso para gestionar el personal';
  end if;

  v_c := employee_clean(p_data);
  if v_c ->> 'last_name' is null or v_c ->> 'first_name' is null then
    raise exception 'Apellido y nombre son obligatorios';
  end if;
  if v_c ->> 'dni' is null then raise exception 'El DNI es obligatorio'; end if;
  perform employee_check_cuil(v_c ->> 'dni', v_c ->> 'cuil');

  if exists (select 1 from employees where dni = v_c ->> 'dni') then
    raise exception 'Ya existe un empleado con el DNI %', v_c ->> 'dni';
  end if;
  if v_c ->> 'legajo' is not null and exists (select 1 from employees where lower(legajo) = lower(v_c ->> 'legajo')) then
    raise exception 'Ya existe un empleado con el legajo %', v_c ->> 'legajo';
  end if;
  if v_c ->> 'profile_id' is not null and exists (select 1 from employees where profile_id = (v_c ->> 'profile_id')::uuid) then
    raise exception 'Ese usuario ya está vinculado a otro empleado';
  end if;

  insert into employees (legajo, last_name, first_name, dni, cuil, birth_date, hire_date, position,
                         job_category, plant_id, profile_id, created_by, updated_by)
  values (v_c ->> 'legajo', v_c ->> 'last_name', v_c ->> 'first_name', v_c ->> 'dni', v_c ->> 'cuil',
          (v_c ->> 'birth_date')::date, (v_c ->> 'hire_date')::date, v_c ->> 'position',
          v_c ->> 'job_category', (v_c ->> 'plant_id')::uuid, (v_c ->> 'profile_id')::uuid, auth.uid(), auth.uid())
  returning * into v_row;

  insert into employee_events (employee_id, actor_id, event_type, new_value)
  values (v_row.id, auth.uid(), 'alta', v_c);

  return v_row;
end;
$function$;

create or replace function public.update_employee(p_id uuid, p_data jsonb)
returns employees
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_c jsonb;
  v_old employees;
  v_row employees;
  v_k text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('personal', true) then
    raise exception 'Sin permiso para gestionar el personal';
  end if;

  select * into v_old from employees where id = p_id for update;
  if v_old.id is null then raise exception 'Empleado no encontrado'; end if;

  v_c := employee_clean(p_data);
  -- El estado y la fecha de baja no se editan acá: van por set_employee_status.
  if (v_c ? 'last_name' and v_c ->> 'last_name' is null) or (v_c ? 'first_name' and v_c ->> 'first_name' is null) then
    raise exception 'Apellido y nombre son obligatorios';
  end if;
  if v_c ? 'dni' and v_c ->> 'dni' is null then raise exception 'El DNI es obligatorio'; end if;

  perform employee_check_cuil(
    case when v_c ? 'dni' then v_c ->> 'dni' else v_old.dni end,
    case when v_c ? 'cuil' then v_c ->> 'cuil' else v_old.cuil end);

  if v_c ? 'dni' and exists (select 1 from employees where dni = v_c ->> 'dni' and id <> p_id) then
    raise exception 'Ya existe otro empleado con el DNI %', v_c ->> 'dni';
  end if;
  if v_c ->> 'legajo' is not null
     and exists (select 1 from employees where lower(legajo) = lower(v_c ->> 'legajo') and id <> p_id) then
    raise exception 'Ya existe otro empleado con el legajo %', v_c ->> 'legajo';
  end if;
  if v_c ->> 'profile_id' is not null
     and exists (select 1 from employees where profile_id = (v_c ->> 'profile_id')::uuid and id <> p_id) then
    raise exception 'Ese usuario ya está vinculado a otro empleado';
  end if;

  update employees e set
    legajo = case when v_c ? 'legajo' then v_c ->> 'legajo' else e.legajo end,
    last_name = case when v_c ? 'last_name' then v_c ->> 'last_name' else e.last_name end,
    first_name = case when v_c ? 'first_name' then v_c ->> 'first_name' else e.first_name end,
    dni = case when v_c ? 'dni' then v_c ->> 'dni' else e.dni end,
    cuil = case when v_c ? 'cuil' then v_c ->> 'cuil' else e.cuil end,
    birth_date = case when v_c ? 'birth_date' then (v_c ->> 'birth_date')::date else e.birth_date end,
    hire_date = case when v_c ? 'hire_date' then (v_c ->> 'hire_date')::date else e.hire_date end,
    position = case when v_c ? 'position' then v_c ->> 'position' else e.position end,
    job_category = case when v_c ? 'job_category' then v_c ->> 'job_category' else e.job_category end,
    plant_id = case when v_c ? 'plant_id' then (v_c ->> 'plant_id')::uuid else e.plant_id end,
    profile_id = case when v_c ? 'profile_id' then (v_c ->> 'profile_id')::uuid else e.profile_id end
  where e.id = p_id
  returning * into v_row;

  for v_k in select jsonb_object_keys(v_c) loop
    if to_jsonb(v_old) -> v_k is distinct from to_jsonb(v_row) -> v_k then
      v_before := v_before || jsonb_build_object(v_k, to_jsonb(v_old) -> v_k);
      v_after := v_after || jsonb_build_object(v_k, to_jsonb(v_row) -> v_k);
    end if;
  end loop;

  if v_after = '{}'::jsonb then return v_old; end if;

  update employees set updated_at = now(), updated_by = auth.uid() where id = p_id returning * into v_row;
  insert into employee_events (employee_id, actor_id, event_type, old_value, new_value)
  values (p_id, auth.uid(), 'edicion', v_before, v_after);

  return v_row;
end;
$function$;

create or replace function public.set_employee_status(
  p_id uuid,
  p_status text,
  p_date date default null,
  p_note text default null
)
returns employees
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old employees;
  v_row employees;
  v_date date;
  v_event text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('personal', true) then
    raise exception 'Sin permiso para gestionar el personal';
  end if;
  if p_status is null or p_status not in ('activo', 'licencia', 'baja') then
    raise exception 'Estado inválido';
  end if;

  select * into v_old from employees where id = p_id for update;
  if v_old.id is null then raise exception 'Empleado no encontrado'; end if;
  if v_old.status = p_status then raise exception 'El empleado ya está en estado %', p_status; end if;

  if p_status = 'baja' then
    v_date := coalesce(p_date, current_date);
    if v_old.hire_date is not null and v_date < v_old.hire_date then
      raise exception 'La fecha de baja no puede ser anterior al ingreso';
    end if;
    v_event := 'baja';
  else
    v_date := null;
    v_event := case
      when v_old.status = 'baja' then 'reactivacion'
      when p_status = 'licencia' then 'licencia'
      else 'fin_licencia'
    end;
  end if;

  update employees
  set status = p_status, termination_date = v_date, updated_at = now(), updated_by = auth.uid()
  where id = p_id
  returning * into v_row;

  insert into employee_events (employee_id, actor_id, event_type, old_value, new_value, note)
  values (p_id, auth.uid(), v_event,
          jsonb_build_object('status', v_old.status, 'termination_date', v_old.termination_date),
          jsonb_build_object('status', v_row.status, 'termination_date', v_row.termination_date),
          nullif(btrim(coalesce(p_note, '')), ''));

  return v_row;
end;
$function$;

-- Importación masiva. p_rows: arreglo de objetos con legajo, last_name, first_name, dni, cuil, birth_date,
-- hire_date, position, job_category y area (nombre del área/planta). Todo o nada: si una fila falla, no se
-- guarda ninguna y se devuelven los errores por fila (número de fila de datos, desde 1). El DNI identifica
-- a la persona: si ya existe se actualizan solo las celdas con dato (una celda vacía no borra nada).
create or replace function public.import_employees(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row jsonb;
  v_c jsonb;
  v_clean jsonb[] := '{}';
  v_errors jsonb := '[]'::jsonb;
  v_dnis text[] := '{}';
  v_legajos text[] := '{}';
  v_area text;
  v_plant uuid;
  v_i int := 0;
  v_exist employees;
  v_new employees;
  v_k text;
  v_before jsonb;
  v_after jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_unchanged int := 0;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('personal', true) then
    raise exception 'Sin permiso para gestionar el personal';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'El archivo no tiene filas para importar';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Se pueden importar hasta 1000 filas por vez';
  end if;

  -- Pasada 1: validar todo sin escribir.
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    begin
      if jsonb_typeof(v_row) <> 'object' then raise exception 'Fila inválida'; end if;
      v_c := employee_clean(v_row - 'area' - 'status' - 'termination_date' - 'profile_id' - 'plant_id');
      if v_c ->> 'last_name' is null or v_c ->> 'first_name' is null then
        raise exception 'Apellido y nombre son obligatorios';
      end if;
      if v_c ->> 'dni' is null then raise exception 'El DNI es obligatorio'; end if;
      perform employee_check_cuil(v_c ->> 'dni', v_c ->> 'cuil');

      v_area := nullif(btrim(coalesce(v_row ->> 'area', '')), '');
      if v_area is not null then
        select id into v_plant from plants where lower(name) = lower(v_area) order by active desc limit 1;
        if v_plant is null then raise exception 'No existe el área "%"', v_area; end if;
        v_c := v_c || jsonb_build_object('plant_id', v_plant);
      end if;

      if v_c ->> 'dni' = any (v_dnis) then raise exception 'DNI repetido en el archivo: %', v_c ->> 'dni'; end if;
      v_dnis := v_dnis || (v_c ->> 'dni');
      if v_c ->> 'legajo' is not null then
        if lower(v_c ->> 'legajo') = any (v_legajos) then
          raise exception 'Legajo repetido en el archivo: %', v_c ->> 'legajo';
        end if;
        v_legajos := v_legajos || lower(v_c ->> 'legajo');
        if exists (select 1 from employees where lower(legajo) = lower(v_c ->> 'legajo') and dni <> v_c ->> 'dni') then
          raise exception 'El legajo % ya pertenece a otro empleado', v_c ->> 'legajo';
        end if;
      end if;

      v_clean := v_clean || v_c;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'message', sqlerrm);
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object('ok', false, 'created', 0, 'updated', 0, 'unchanged', 0, 'errors', v_errors);
  end if;

  -- Pasada 2: escribir.
  foreach v_c in array v_clean loop
    v_c := jsonb_strip_nulls(v_c);
    select * into v_exist from employees where dni = v_c ->> 'dni' for update;

    if v_exist.id is null then
      insert into employees (legajo, last_name, first_name, dni, cuil, birth_date, hire_date, position,
                             job_category, plant_id, created_by, updated_by)
      values (v_c ->> 'legajo', v_c ->> 'last_name', v_c ->> 'first_name', v_c ->> 'dni', v_c ->> 'cuil',
              (v_c ->> 'birth_date')::date, (v_c ->> 'hire_date')::date, v_c ->> 'position',
              v_c ->> 'job_category', (v_c ->> 'plant_id')::uuid, auth.uid(), auth.uid())
      returning * into v_new;
      insert into employee_events (employee_id, actor_id, event_type, new_value, note)
      values (v_new.id, auth.uid(), 'alta', v_c, 'Importación');
      v_created := v_created + 1;
    else
      update employees e set
        legajo = coalesce(v_c ->> 'legajo', e.legajo),
        last_name = coalesce(v_c ->> 'last_name', e.last_name),
        first_name = coalesce(v_c ->> 'first_name', e.first_name),
        cuil = coalesce(v_c ->> 'cuil', e.cuil),
        birth_date = coalesce((v_c ->> 'birth_date')::date, e.birth_date),
        hire_date = coalesce((v_c ->> 'hire_date')::date, e.hire_date),
        position = coalesce(v_c ->> 'position', e.position),
        job_category = coalesce(v_c ->> 'job_category', e.job_category),
        plant_id = coalesce((v_c ->> 'plant_id')::uuid, e.plant_id)
      where e.id = v_exist.id
      returning * into v_new;

      v_before := '{}'::jsonb;
      v_after := '{}'::jsonb;
      for v_k in select jsonb_object_keys(v_c) loop
        if to_jsonb(v_exist) -> v_k is distinct from to_jsonb(v_new) -> v_k then
          v_before := v_before || jsonb_build_object(v_k, to_jsonb(v_exist) -> v_k);
          v_after := v_after || jsonb_build_object(v_k, to_jsonb(v_new) -> v_k);
        end if;
      end loop;

      if v_after = '{}'::jsonb then
        v_unchanged := v_unchanged + 1;
      else
        update employees set updated_at = now(), updated_by = auth.uid() where id = v_exist.id;
        insert into employee_events (employee_id, actor_id, event_type, old_value, new_value, note)
        values (v_exist.id, auth.uid(), 'edicion', v_before, v_after, 'Importación');
        v_updated := v_updated + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'created', v_created, 'updated', v_updated, 'unchanged', v_unchanged,
                            'errors', '[]'::jsonb);
end;
$function$;

-- Las exportaciones se arman en el navegador con lo que ya se pudo leer; esto deja constancia de quién
-- exportó y cuántas filas.
create or replace function public.log_employee_export(p_count integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('personal', true) then
    raise exception 'Sin permiso para gestionar el personal';
  end if;
  insert into employee_events (employee_id, actor_id, event_type, new_value)
  values (null, auth.uid(), 'exportacion', jsonb_build_object('cantidad', coalesce(p_count, 0)));
end;
$function$;

revoke execute on function public.create_employee(jsonb) from public, anon;
revoke execute on function public.update_employee(uuid, jsonb) from public, anon;
revoke execute on function public.set_employee_status(uuid, text, date, text) from public, anon;
revoke execute on function public.import_employees(jsonb) from public, anon;
revoke execute on function public.log_employee_export(integer) from public, anon;
grant execute on function public.create_employee(jsonb) to authenticated;
grant execute on function public.update_employee(uuid, jsonb) to authenticated;
grant execute on function public.set_employee_status(uuid, text, date, text) to authenticated;
grant execute on function public.import_employees(jsonb) to authenticated;
grant execute on function public.log_employee_export(integer) to authenticated;
