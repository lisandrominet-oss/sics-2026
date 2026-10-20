-- Módulo "Roster" (Fase 2a): funciones de lectura (cálculo del calendario) y de escritura.
-- Todas SECURITY DEFINER con has_module('roster', true), mensajes en español y auditoría en roster_events.
-- El calendario de cada persona se CALCULA acá (roster_state): la pantalla solo lo dibuja.

-- ---------------------------------------------------------------- helpers internos (sin acceso directo)
create or replace function public.roster_require()
returns void
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('roster', true) then raise exception 'Sin permiso para usar el roster'; end if;
end;
$function$;

-- Fecha en formato AAAA-MM-DD (otro formato se interpretaría según el DateStyle del servidor). Vacío = null.
create or replace function public.roster_date(p_text text, p_label text)
returns date
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  t text := nullif(btrim(coalesce(p_text, '')), '');
  d date;
begin
  if t is null then return null; end if;
  if t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Fecha inválida en %: %. Usá el formato AAAA-MM-DD', p_label, t;
  end if;
  begin
    d := t::date;
  exception when others then
    raise exception 'Fecha inválida en %: %', p_label, t;
  end;
  if d < date '2000-01-01' or d > date '2100-01-01' then
    raise exception 'Fecha fuera de rango en %: %', p_label, t;
  end if;
  return d;
end;
$function$;

create or replace function public.roster_uuid(p_text text, p_label text)
returns uuid
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  t text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if t is null then return null; end if;
  begin
    return t::uuid;
  exception when others then
    raise exception 'Dato inválido en %', p_label;
  end;
end;
$function$;

create or replace function public.roster_log(p_entity text, p_entity_id uuid, p_type text, p_old jsonb, p_new jsonb, p_note text default null)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  insert into roster_events (entity, entity_id, actor_id, event_type, old_value, new_value, note)
  values (p_entity, p_entity_id, auth.uid(), p_type, p_old, p_new, p_note);
$function$;

-- Largo del ciclo y largo del bloque de trabajo (con viaje) de un régimen.
create or replace function public.roster_pattern_cycle(p_work int, p_rest int, p_tin int, p_tout int, p_inside boolean)
returns int
language sql
immutable
as $function$
  select p_work + p_rest + case when p_inside then 0 else p_tin + p_tout end;
$function$;

revoke execute on function public.roster_require() from public, anon, authenticated;
revoke execute on function public.roster_date(text, text) from public, anon, authenticated;
revoke execute on function public.roster_uuid(text, text) from public, anon, authenticated;
revoke execute on function public.roster_log(text, uuid, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.roster_pattern_cycle(int, int, int, int, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- lectura
-- Qué hace cada persona asignada cada día del rango (máx. 62 días).
-- Estado: trabajo | franco | viaje_subida | viaje_bajada | vacaciones | licencia | enfermedad | ausencia.
-- Posición en el ciclo = (día - fecha_ancla) mod largo_del_ciclo. El turno (solo en 'trabajo') alterna entre
-- ciclos si alternate_shift. El calendario se corta en la fecha de baja del empleado.
create or replace function public.roster_state(p_from date, p_to date, p_site_id uuid default null)
returns table (
  employee_id uuid,
  assignment_id uuid,
  site_id uuid,
  crew_id uuid,
  position_id uuid,
  day date,
  state text,
  shift text,
  extended boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  perform roster_require();
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rango de fechas inválido'; end if;
  if p_to - p_from > 61 then raise exception 'El rango no puede superar los 62 días'; end if;

  return query
  with a as (
    select x.id, x.employee_id, x.site_id, x.crew_id, x.position_id, x.anchor_date, x.shift, x.alternate_shift,
           x.valid_from, x.valid_to, p.travel_in_days as tin, p.travel_out_days as tout,
           roster_pattern_cycle(p.work_days, p.rest_days, p.travel_in_days, p.travel_out_days, p.travel_inside_cycle) as cyc,
           case when p.travel_inside_cycle then p.work_days else p.travel_in_days + p.work_days + p.travel_out_days end as wt,
           e.termination_date
    from roster_assignments x
    join roster_patterns p on p.id = x.pattern_id
    join employees e on e.id = x.employee_id
    where (p_site_id is null or x.site_id = p_site_id)
      and x.valid_from <= p_to
      and (x.valid_to is null or x.valid_to >= p_from)
  ), b as (
    select a.*, d.day,
           (((d.day - a.anchor_date) % a.cyc) + a.cyc) % a.cyc as off
    from a
    cross join lateral (
      select g::date as day
      from generate_series(
        greatest(p_from, a.valid_from)::timestamp,
        least(p_to, coalesce(a.valid_to, p_to), coalesce(a.termination_date, p_to))::timestamp,
        interval '1 day') g
    ) d
  ), c as (
    select b.employee_id, b.id as assignment_id, b.site_id, b.crew_id, b.position_id, b.day, ex.kind as ex_kind,
           case when b.off < b.tin then 'viaje_subida'
                when b.off < b.wt - b.tout then 'trabajo'
                when b.off < b.wt then 'viaje_bajada'
                else 'franco' end as base_state,
           case when b.alternate_shift and (((b.day - b.anchor_date) - b.off) / b.cyc) % 2 <> 0
                then (case b.shift when 'dia' then 'noche' else 'dia' end)
                else b.shift end as eff_shift
    from b
    left join lateral (
      select x.kind
      from roster_exceptions x
      where x.employee_id = b.employee_id and b.day between x.date_from and x.date_to
      order by (x.kind in ('vacaciones', 'licencia', 'enfermedad', 'ausencia')) desc, x.created_at desc
      limit 1
    ) ex on true
  )
  select c.employee_id, c.assignment_id, c.site_id, c.crew_id, c.position_id, c.day,
         s.state,
         case when s.state = 'trabajo' then c.eff_shift else null end,
         coalesce(c.ex_kind = 'extension' and s.state = 'trabajo', false)
  from c
  cross join lateral (
    select case c.ex_kind
             when 'vacaciones' then 'vacaciones'
             when 'licencia' then 'licencia'
             when 'enfermedad' then 'enfermedad'
             when 'ausencia' then 'ausencia'
             when 'extension' then 'trabajo'
             when 'franco_extra' then 'franco'
             else c.base_state end as state
  ) s
  order by c.employee_id, c.day;
end;
$function$;

-- Asignaciones con nombres (sin DNI ni otros datos personales).
create or replace function public.roster_assignments_list(
  p_site_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_only_current boolean default false
)
returns table (
  id uuid,
  employee_id uuid,
  last_name text,
  first_name text,
  legajo text,
  employee_status text,
  site_id uuid,
  site_name text,
  position_id uuid,
  position_name text,
  crew_id uuid,
  crew_name text,
  pattern_id uuid,
  pattern_name text,
  anchor_date date,
  shift text,
  alternate_shift boolean,
  valid_from date,
  valid_to date
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform roster_require();
  return query
  select a.id, a.employee_id, e.last_name, e.first_name, e.legajo, e.status,
         a.site_id, s.name, a.position_id, po.name, a.crew_id, c.name, a.pattern_id, pa.name,
         a.anchor_date, a.shift, a.alternate_shift, a.valid_from, a.valid_to
  from roster_assignments a
  join employees e on e.id = a.employee_id
  join roster_sites s on s.id = a.site_id
  join roster_patterns pa on pa.id = a.pattern_id
  left join roster_positions po on po.id = a.position_id
  left join roster_crews c on c.id = a.crew_id
  where (p_site_id is null or a.site_id = p_site_id)
    and (p_from is null or a.valid_to is null or a.valid_to >= p_from)
    and (p_to is null or a.valid_from <= p_to)
    and (not p_only_current or a.valid_to is null or a.valid_to >= v_today)
  order by s.name, c.name nulls last, e.last_name, e.first_name, a.valid_from;
end;
$function$;

-- Empleados que se pueden asignar (activos o en licencia): solo nombre y legajo.
create or replace function public.roster_employee_options()
returns table (id uuid, last_name text, first_name text, legajo text, status text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  perform roster_require();
  return query
  select e.id, e.last_name, e.first_name, e.legajo, e.status
  from employees e
  where e.status <> 'baja'
  order by e.last_name, e.first_name;
end;
$function$;

-- ---------------------------------------------------------------- configuración (sitios, regímenes, puestos, cuadrillas)
create or replace function public.roster_save_site(p_id uuid, p_name text, p_code text default null, p_active boolean default true)
returns roster_sites
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_old roster_sites;
  v_row roster_sites;
begin
  perform roster_require();
  if v_name is null then raise exception 'El nombre del sitio es obligatorio'; end if;
  if length(v_name) > 120 or length(coalesce(v_code, '')) > 20 then raise exception 'Nombre o código demasiado largo'; end if;

  if p_id is null then
    insert into roster_sites (name, code, active) values (v_name, v_code, coalesce(p_active, true)) returning * into v_row;
    perform roster_log('sitio', v_row.id, 'alta', null, to_jsonb(v_row));
  else
    select * into v_old from roster_sites where id = p_id for update;
    if v_old.id is null then raise exception 'Sitio no encontrado'; end if;
    if v_old.active and not coalesce(p_active, true)
       and exists (select 1 from roster_assignments a where a.site_id = p_id and (a.valid_to is null or a.valid_to >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)) then
      raise exception 'El sitio tiene asignaciones vigentes: terminalas antes de desactivarlo';
    end if;
    update roster_sites set name = v_name, code = v_code, active = coalesce(p_active, true) where id = p_id returning * into v_row;
    perform roster_log('sitio', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
exception when unique_violation then
  raise exception 'Ya existe un sitio con ese nombre';
end;
$function$;

-- Un régimen en uso no cambia sus días (el calendario pasado se recalcularía): se crea uno nuevo.
create or replace function public.roster_save_pattern(
  p_id uuid,
  p_name text,
  p_work_days integer,
  p_rest_days integer,
  p_travel_in_days integer default 0,
  p_travel_out_days integer default 0,
  p_travel_inside_cycle boolean default true,
  p_active boolean default true
)
returns roster_patterns
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_old roster_patterns;
  v_row roster_patterns;
begin
  perform roster_require();
  if v_name is null then raise exception 'El nombre del régimen es obligatorio'; end if;
  if length(v_name) > 60 then raise exception 'Nombre demasiado largo'; end if;

  if p_id is null then
    insert into roster_patterns (name, work_days, rest_days, travel_in_days, travel_out_days, travel_inside_cycle, active)
    values (v_name, p_work_days, p_rest_days, coalesce(p_travel_in_days, 0), coalesce(p_travel_out_days, 0),
            coalesce(p_travel_inside_cycle, true), coalesce(p_active, true))
    returning * into v_row;
    perform roster_log('regimen', v_row.id, 'alta', null, to_jsonb(v_row));
  else
    select * into v_old from roster_patterns where id = p_id for update;
    if v_old.id is null then raise exception 'Régimen no encontrado'; end if;
    if exists (select 1 from roster_assignments where pattern_id = p_id)
       and (v_old.work_days, v_old.rest_days, v_old.travel_in_days, v_old.travel_out_days, v_old.travel_inside_cycle)
           is distinct from (p_work_days, p_rest_days, coalesce(p_travel_in_days, 0), coalesce(p_travel_out_days, 0), coalesce(p_travel_inside_cycle, true)) then
      raise exception 'El régimen ya está en uso: creá uno nuevo para cambiar sus días (así el calendario pasado no se modifica)';
    end if;
    update roster_patterns
    set name = v_name, work_days = p_work_days, rest_days = p_rest_days,
        travel_in_days = coalesce(p_travel_in_days, 0), travel_out_days = coalesce(p_travel_out_days, 0),
        travel_inside_cycle = coalesce(p_travel_inside_cycle, true), active = coalesce(p_active, true)
    where id = p_id returning * into v_row;
    perform roster_log('regimen', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
exception
  when unique_violation then raise exception 'Ya existe un régimen con ese nombre';
  when check_violation then raise exception 'Datos del régimen inválidos: revisá los días (los de viaje tienen que caber dentro del bloque de trabajo si van dentro del ciclo)';
end;
$function$;

create or replace function public.roster_save_position(
  p_id uuid,
  p_site_id uuid,
  p_name text,
  p_shift text default 'cualquiera',
  p_required_count integer default 1,
  p_active boolean default true
)
returns roster_positions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_old roster_positions;
  v_row roster_positions;
begin
  perform roster_require();
  if v_name is null then raise exception 'El nombre del puesto es obligatorio'; end if;
  if length(v_name) > 120 then raise exception 'Nombre demasiado largo'; end if;
  if p_shift is null or p_shift not in ('dia', 'noche', 'cualquiera') then raise exception 'Turno inválido'; end if;
  if p_required_count is null or p_required_count < 0 or p_required_count > 500 then raise exception 'La dotación requerida tiene que estar entre 0 y 500'; end if;

  if p_id is null then
    if not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Sitio no encontrado'; end if;
    insert into roster_positions (site_id, name, shift, required_count, active)
    values (p_site_id, v_name, p_shift, p_required_count, coalesce(p_active, true)) returning * into v_row;
    perform roster_log('puesto', v_row.id, 'alta', null, to_jsonb(v_row));
  else
    select * into v_old from roster_positions where id = p_id for update;
    if v_old.id is null then raise exception 'Puesto no encontrado'; end if;
    update roster_positions set name = v_name, shift = p_shift, required_count = p_required_count, active = coalesce(p_active, true)
    where id = p_id returning * into v_row;
    perform roster_log('puesto', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
exception when unique_violation then
  raise exception 'Ya existe ese puesto con ese turno en el sitio';
end;
$function$;

create or replace function public.roster_save_crew(p_id uuid, p_site_id uuid, p_name text, p_active boolean default true)
returns roster_crews
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_old roster_crews;
  v_row roster_crews;
begin
  perform roster_require();
  if v_name is null then raise exception 'El nombre de la cuadrilla es obligatorio'; end if;
  if length(v_name) > 60 then raise exception 'Nombre demasiado largo'; end if;

  if p_id is null then
    if not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Sitio no encontrado'; end if;
    insert into roster_crews (site_id, name, active) values (p_site_id, v_name, coalesce(p_active, true)) returning * into v_row;
    perform roster_log('cuadrilla', v_row.id, 'alta', null, to_jsonb(v_row));
  else
    select * into v_old from roster_crews where id = p_id for update;
    if v_old.id is null then raise exception 'Cuadrilla no encontrada'; end if;
    update roster_crews set name = v_name, active = coalesce(p_active, true) where id = p_id returning * into v_row;
    perform roster_log('cuadrilla', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
exception when unique_violation then
  raise exception 'Ya existe una cuadrilla con ese nombre en el sitio';
end;
$function$;

-- ---------------------------------------------------------------- asignaciones
-- Alta de una asignación (la usan create_assignment, assign_crew y change_assignment). Bloquea al empleado para
-- que dos altas simultáneas no se superpongan.
create or replace function public.roster_insert_assignment(p_data jsonb)
returns roster_assignments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_from date := roster_date(p_data ->> 'valid_from', 'Vigente desde');
  v_to date := roster_date(p_data ->> 'valid_to', 'Vigente hasta');
  v_anchor date := roster_date(p_data ->> 'anchor_date', 'Fecha ancla');
  v_shift text := coalesce(nullif(p_data ->> 'shift', ''), 'dia');
  v_alt boolean := lower(coalesce(p_data ->> 'alternate_shift', 'false')) in ('true', 't', '1');
  v_emp employees;
  v_site roster_sites;
  v_pat roster_patterns;
  v_pos roster_positions;
  v_crew roster_crews;
  v_pos_id uuid := roster_uuid(p_data ->> 'position_id', 'puesto');
  v_crew_id uuid := roster_uuid(p_data ->> 'crew_id', 'cuadrilla');
  v_row roster_assignments;
begin
  if v_from is null then raise exception 'La fecha de inicio es obligatoria'; end if;
  if v_to is not null and v_to < v_from then raise exception 'La fecha de fin no puede ser anterior al inicio'; end if;
  if v_shift not in ('dia', 'noche') then raise exception 'Turno inválido'; end if;
  v_anchor := coalesce(v_anchor, v_from);

  select * into v_emp from employees where id = roster_uuid(p_data ->> 'employee_id', 'empleado') for update;
  if v_emp.id is null then raise exception 'Empleado no encontrado'; end if;
  if v_emp.status = 'baja' then raise exception 'El empleado está dado de baja'; end if;
  if v_emp.termination_date is not null and v_from > v_emp.termination_date then
    raise exception 'La asignación empieza después de la fecha de baja del empleado';
  end if;

  select * into v_site from roster_sites where id = roster_uuid(p_data ->> 'site_id', 'sitio');
  if v_site.id is null then raise exception 'Sitio no encontrado'; end if;
  if not v_site.active then raise exception 'El sitio está desactivado'; end if;
  select * into v_pat from roster_patterns where id = roster_uuid(p_data ->> 'pattern_id', 'régimen');
  if v_pat.id is null then raise exception 'Régimen no encontrado'; end if;
  if not v_pat.active then raise exception 'El régimen está desactivado'; end if;

  if v_pos_id is not null then
    select * into v_pos from roster_positions where id = v_pos_id;
    if v_pos.id is null or v_pos.site_id <> v_site.id then raise exception 'El puesto no pertenece al sitio elegido'; end if;
  end if;
  if v_crew_id is not null then
    select * into v_crew from roster_crews where id = v_crew_id;
    if v_crew.id is null or v_crew.site_id <> v_site.id then raise exception 'La cuadrilla no pertenece al sitio elegido'; end if;
  end if;

  if exists (
    select 1 from roster_assignments x
    where x.employee_id = v_emp.id
      and x.valid_from <= coalesce(v_to, 'infinity'::date)
      and (x.valid_to is null or x.valid_to >= v_from)
  ) then
    raise exception '% ya tiene una asignación en esas fechas', v_emp.last_name || ', ' || v_emp.first_name;
  end if;

  insert into roster_assignments (employee_id, site_id, position_id, crew_id, pattern_id, anchor_date, shift,
                                  alternate_shift, valid_from, valid_to, created_by, updated_by)
  values (v_emp.id, v_site.id, v_pos_id, v_crew_id, v_pat.id, v_anchor, v_shift, v_alt, v_from, v_to, auth.uid(), auth.uid())
  returning * into v_row;

  perform roster_log('asignacion', v_row.id, 'alta', null, to_jsonb(v_row));
  return v_row;
end;
$function$;

create or replace function public.roster_create_assignment(p_data jsonb)
returns roster_assignments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform roster_require();
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos de la asignación inválidos'; end if;
  return roster_insert_assignment(p_data);
end;
$function$;

-- Mismos datos para varias personas (una cuadrilla). Todo o nada: si una falla, no se crea ninguna.
create or replace function public.roster_assign_crew(p_data jsonb, p_employee_ids uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_name text;
  v_n integer := 0;
begin
  perform roster_require();
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos de la asignación inválidos'; end if;
  if p_employee_ids is null or coalesce(array_length(p_employee_ids, 1), 0) = 0 then raise exception 'Elegí al menos una persona'; end if;
  if array_length(p_employee_ids, 1) > 200 then raise exception 'Se pueden asignar hasta 200 personas por vez'; end if;

  foreach v_id in array p_employee_ids loop
    begin
      perform roster_insert_assignment(p_data || jsonb_build_object('employee_id', v_id));
      v_n := v_n + 1;
    exception when others then
      select e.last_name || ', ' || e.first_name into v_name from employees e where e.id = v_id;
      raise exception '%: %', coalesce(v_name, 'Empleado'), sqlerrm;
    end;
  end loop;
  return v_n;
end;
$function$;

-- Cambios que NO alteran el calendario ya calculado: puesto, cuadrilla y fecha de fin.
create or replace function public.roster_update_assignment(p_id uuid, p_data jsonb)
returns roster_assignments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_assignments;
  v_row roster_assignments;
  v_pos_id uuid;
  v_crew_id uuid;
  v_to date;
  v_pos roster_positions;
  v_crew roster_crews;
begin
  perform roster_require();
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  if (p_data - 'position_id' - 'crew_id' - 'valid_to') <> '{}'::jsonb then
    raise exception 'Acá solo se cambian el puesto, la cuadrilla y la fecha de fin. Para cambiar el régimen, la fecha ancla o el turno usá «Cambiar desde una fecha»';
  end if;

  select * into v_old from roster_assignments where id = p_id for update;
  if v_old.id is null then raise exception 'Asignación no encontrada'; end if;

  v_pos_id := case when p_data ? 'position_id' then roster_uuid(p_data ->> 'position_id', 'puesto') else v_old.position_id end;
  v_crew_id := case when p_data ? 'crew_id' then roster_uuid(p_data ->> 'crew_id', 'cuadrilla') else v_old.crew_id end;
  v_to := case when p_data ? 'valid_to' then roster_date(p_data ->> 'valid_to', 'Vigente hasta') else v_old.valid_to end;

  if v_to is not null and v_to < v_old.valid_from then raise exception 'La fecha de fin no puede ser anterior al inicio'; end if;
  if v_pos_id is not null then
    select * into v_pos from roster_positions where id = v_pos_id;
    if v_pos.id is null or v_pos.site_id <> v_old.site_id then raise exception 'El puesto no pertenece al sitio de la asignación'; end if;
  end if;
  if v_crew_id is not null then
    select * into v_crew from roster_crews where id = v_crew_id;
    if v_crew.id is null or v_crew.site_id <> v_old.site_id then raise exception 'La cuadrilla no pertenece al sitio de la asignación'; end if;
  end if;
  if exists (
    select 1 from roster_assignments x
    where x.employee_id = v_old.employee_id and x.id <> v_old.id
      and x.valid_from > v_old.valid_from
      and x.valid_from <= coalesce(v_to, 'infinity'::date)
  ) then
    raise exception 'La fecha de fin se superpone con otra asignación de la misma persona';
  end if;

  update roster_assignments
  set position_id = v_pos_id, crew_id = v_crew_id, valid_to = v_to, updated_at = now(), updated_by = auth.uid()
  where id = p_id returning * into v_row;

  if to_jsonb(v_old) is distinct from to_jsonb(v_row) then
    perform roster_log('asignacion', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
end;
$function$;

-- Cambia sitio, puesto, cuadrilla, régimen, ancla o turno DESDE una fecha: la asignación vigente termina el día
-- anterior y empieza otra con los datos nuevos (el pasado no se reescribe).
create or replace function public.roster_change_assignment(p_id uuid, p_effective_from date, p_data jsonb)
returns roster_assignments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_assignments;
  v_new roster_assignments;
  v_data jsonb;
begin
  perform roster_require();
  if p_effective_from is null then raise exception 'La fecha del cambio es obligatoria'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  if (p_data - 'site_id' - 'position_id' - 'crew_id' - 'pattern_id' - 'anchor_date' - 'shift' - 'alternate_shift') <> '{}'::jsonb then
    raise exception 'Datos del cambio inválidos';
  end if;

  select * into v_old from roster_assignments where id = p_id for update;
  if v_old.id is null then raise exception 'Asignación no encontrada'; end if;
  if p_effective_from <= v_old.valid_from then
    raise exception 'La fecha del cambio tiene que ser posterior al inicio de la asignación (para corregirla, terminala y creá una nueva)';
  end if;
  if v_old.valid_to is not null and p_effective_from > v_old.valid_to then
    raise exception 'La fecha del cambio es posterior al fin de la asignación';
  end if;

  v_data := jsonb_build_object(
    'employee_id', v_old.employee_id, 'site_id', v_old.site_id, 'position_id', v_old.position_id,
    'crew_id', v_old.crew_id, 'pattern_id', v_old.pattern_id, 'anchor_date', v_old.anchor_date,
    'shift', v_old.shift, 'alternate_shift', v_old.alternate_shift,
    'valid_from', p_effective_from, 'valid_to', v_old.valid_to) || p_data;
  -- Si cambia el régimen y no se indica ancla, el nuevo ciclo arranca en la fecha del cambio.
  if p_data ? 'pattern_id' and not (p_data ? 'anchor_date') and (p_data ->> 'pattern_id') <> v_old.pattern_id::text then
    v_data := v_data || jsonb_build_object('anchor_date', p_effective_from);
  end if;
  -- Si cambia el sitio, el puesto y la cuadrilla viejos no valen salvo que se indiquen.
  if p_data ? 'site_id' and (p_data ->> 'site_id') <> v_old.site_id::text then
    if not (p_data ? 'position_id') then v_data := v_data || '{"position_id": null}'::jsonb; end if;
    if not (p_data ? 'crew_id') then v_data := v_data || '{"crew_id": null}'::jsonb; end if;
  end if;

  update roster_assignments set valid_to = p_effective_from - 1, updated_at = now(), updated_by = auth.uid() where id = p_id;
  v_new := roster_insert_assignment(v_data);
  perform roster_log('asignacion', p_id, 'cambio', to_jsonb(v_old), to_jsonb(v_new), 'Cambio desde ' || p_effective_from::text);
  return v_new;
end;
$function$;

-- ---------------------------------------------------------------- excepciones
create or replace function public.roster_add_exception(
  p_employee_id uuid,
  p_kind text,
  p_from date,
  p_to date,
  p_note text default null,
  p_covers_employee_id uuid default null
)
returns roster_exceptions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row roster_exceptions;
begin
  perform roster_require();
  if p_kind is null or p_kind not in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'extension', 'franco_extra') then
    raise exception 'Tipo de excepción inválido';
  end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Fechas inválidas: el fin no puede ser anterior al inicio'; end if;
  if p_to - p_from > 365 then raise exception 'Una excepción no puede durar más de un año'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;
  if not exists (select 1 from employees where id = p_employee_id) then raise exception 'Empleado no encontrado'; end if;
  if p_covers_employee_id is not null and not exists (select 1 from employees where id = p_covers_employee_id) then
    raise exception 'La persona a la que reemplaza no existe';
  end if;

  insert into roster_exceptions (employee_id, kind, date_from, date_to, note, covers_employee_id, created_by)
  values (p_employee_id, p_kind, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), p_covers_employee_id, auth.uid())
  returning * into v_row;

  perform roster_log('excepcion', v_row.id, 'alta', null, to_jsonb(v_row));
  return v_row;
end;
$function$;

create or replace function public.roster_delete_exception(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_exceptions;
begin
  perform roster_require();
  delete from roster_exceptions where id = p_id returning * into v_old;
  if v_old.id is null then raise exception 'Excepción no encontrada'; end if;
  perform roster_log('excepcion', p_id, 'baja', to_jsonb(v_old), null);
end;
$function$;

-- ---------------------------------------------------------------- permisos
revoke execute on function public.roster_insert_assignment(jsonb) from public, anon, authenticated;

revoke execute on function public.roster_state(date, date, uuid) from public, anon;
revoke execute on function public.roster_assignments_list(uuid, date, date, boolean) from public, anon;
revoke execute on function public.roster_employee_options() from public, anon;
revoke execute on function public.roster_save_site(uuid, text, text, boolean) from public, anon;
revoke execute on function public.roster_save_pattern(uuid, text, integer, integer, integer, integer, boolean, boolean) from public, anon;
revoke execute on function public.roster_save_position(uuid, uuid, text, text, integer, boolean) from public, anon;
revoke execute on function public.roster_save_crew(uuid, uuid, text, boolean) from public, anon;
revoke execute on function public.roster_create_assignment(jsonb) from public, anon;
revoke execute on function public.roster_assign_crew(jsonb, uuid[]) from public, anon;
revoke execute on function public.roster_update_assignment(uuid, jsonb) from public, anon;
revoke execute on function public.roster_change_assignment(uuid, date, jsonb) from public, anon;
revoke execute on function public.roster_add_exception(uuid, text, date, date, text, uuid) from public, anon;
revoke execute on function public.roster_delete_exception(uuid) from public, anon;

grant execute on function public.roster_state(date, date, uuid) to authenticated;
grant execute on function public.roster_assignments_list(uuid, date, date, boolean) to authenticated;
grant execute on function public.roster_employee_options() to authenticated;
grant execute on function public.roster_save_site(uuid, text, text, boolean) to authenticated;
grant execute on function public.roster_save_pattern(uuid, text, integer, integer, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.roster_save_position(uuid, uuid, text, text, integer, boolean) to authenticated;
grant execute on function public.roster_save_crew(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.roster_create_assignment(jsonb) to authenticated;
grant execute on function public.roster_assign_crew(jsonb, uuid[]) to authenticated;
grant execute on function public.roster_update_assignment(uuid, jsonb) to authenticated;
grant execute on function public.roster_change_assignment(uuid, date, jsonb) to authenticated;
grant execute on function public.roster_add_exception(uuid, text, date, date, text, uuid) to authenticated;
grant execute on function public.roster_delete_exception(uuid) to authenticated;
