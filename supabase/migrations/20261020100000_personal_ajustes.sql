-- Ajustes del módulo Personal tras la revisión de 20261019150000_modulo_personal.sql:
-- 1. CUIL: se quita la rama especial de resto 1 (ese número nunca es un CUIL válido).
-- 2. profile_id: el vínculo con un usuario del sistema queda cerrado hasta que exista la pantalla
--    (con él, un usuario de Personal podía ampliar lo que lee de profiles).
-- 3. Fecha de ingreso posterior a la baja: mensaje en español en update_employee e import_employees
--    (antes saltaba el constraint con un mensaje crudo y, en la importación, abortaba sin número de fila).
-- 4. Altas simultáneas con el mismo DNI/legajo: mensaje claro en vez del error del índice único.
-- 5. Motivo de baja: máximo 500 caracteres.

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
  -- Resto 1: no hay dígito posible (el CUIL se genera de nuevo con prefijo 23), así que no es válido.
  if r = 1 then return false; end if;
  dv := case when r = 0 then 0 else 11 - r end;
  return substr(p_cuil, 11, 1)::int = dv;
end;
$function$;

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

  if nullif(btrim(coalesce(p_data ->> 'profile_id', '')), '') is not null then
    raise exception 'El vínculo con un usuario del sistema todavía no está disponible';
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

  return v;
end;
$function$;

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

  insert into employees (legajo, last_name, first_name, dni, cuil, birth_date, hire_date, position,
                         job_category, plant_id, created_by, updated_by)
  values (v_c ->> 'legajo', v_c ->> 'last_name', v_c ->> 'first_name', v_c ->> 'dni', v_c ->> 'cuil',
          (v_c ->> 'birth_date')::date, (v_c ->> 'hire_date')::date, v_c ->> 'position',
          v_c ->> 'job_category', (v_c ->> 'plant_id')::uuid, auth.uid(), auth.uid())
  returning * into v_row;

  insert into employee_events (employee_id, actor_id, event_type, new_value)
  values (v_row.id, auth.uid(), 'alta', v_c);

  return v_row;
exception when unique_violation then
  raise exception 'Ya existe un empleado con ese DNI o legajo (alguien lo cargó en este momento)';
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
  v_hire date;
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

  v_hire := case when v_c ? 'hire_date' then (v_c ->> 'hire_date')::date else v_old.hire_date end;
  if v_hire is not null and v_old.termination_date is not null and v_hire > v_old.termination_date then
    raise exception 'La fecha de ingreso no puede ser posterior a la fecha de baja (%)', v_old.termination_date;
  end if;

  if v_c ? 'dni' and exists (select 1 from employees where dni = v_c ->> 'dni' and id <> p_id) then
    raise exception 'Ya existe otro empleado con el DNI %', v_c ->> 'dni';
  end if;
  if v_c ->> 'legajo' is not null
     and exists (select 1 from employees where lower(legajo) = lower(v_c ->> 'legajo') and id <> p_id) then
    raise exception 'Ya existe otro empleado con el legajo %', v_c ->> 'legajo';
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
    plant_id = case when v_c ? 'plant_id' then (v_c ->> 'plant_id')::uuid else e.plant_id end
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
exception when unique_violation then
  raise exception 'Ya existe otro empleado con ese DNI o legajo';
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
  if length(coalesce(p_note, '')) > 500 then raise exception 'El motivo es demasiado largo (máximo 500 caracteres)'; end if;

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
  v_termination date;
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
        v_plant := null;
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

      -- Si la persona ya existe y está dada de baja, el ingreso nuevo no puede quedar después de la baja.
      if v_c ->> 'hire_date' is not null then
        select termination_date into v_termination from employees where dni = v_c ->> 'dni';
        if v_termination is not null and (v_c ->> 'hire_date')::date > v_termination then
          raise exception 'La fecha de ingreso es posterior a la baja registrada (%)', v_termination;
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
exception when unique_violation then
  raise exception 'Alguien cargó el mismo DNI o legajo mientras se importaba: volvé a intentarlo';
end;
$function$;
