-- Ajustes del módulo Roster tras la revisión de las migraciones 20261020120000 y 20261020120100:
-- 1. Una baja del empleado cierra su calendario: roster_assignments_list y roster_save_site la tienen en cuenta.
-- 2. Cambiar una asignación (cuadrilla, turno...) ya no falla si el sitio, régimen, puesto o cuadrilla heredados se
--    desactivaron después; sí se valida que no se ELIJAN desactivados.
-- 3. Cambio de régimen o de ancla con turno alternante: el turno que corría ese día se conserva.
-- 4. roster_update_assignment bloquea al empleado (carrera con una alta simultánea) y valida puesto/cuadrilla activos.
-- 5. Nueva roster_void_assignment: anular una asignación futura cargada por error (queda en la auditoría).
-- 6. roster_employee_options ordena también por id (paginación estable); roster_pattern_cycle con search_path.
-- 7. Se quita profiles_select_roster: ningún componente lee roster_events todavía (se vuelve a crear con la pantalla de historial).

drop policy if exists profiles_select_roster on public.profiles;

create or replace function public.roster_pattern_cycle(p_work int, p_rest int, p_tin int, p_tout int, p_inside boolean)
returns int
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  select p_work + p_rest + case when p_inside then 0 else p_tin + p_tout end;
$function$;

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
  order by e.last_name, e.first_name, e.id;
end;
$function$;

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
    and (not p_only_current or (
          (a.valid_to is null or a.valid_to >= v_today)
          and (e.termination_date is null or e.termination_date >= v_today)))
  order by s.name, c.name nulls last, e.last_name, e.first_name, a.valid_from, a.id;
end;
$function$;

create or replace function public.roster_save_site(p_id uuid, p_name text, p_code text default null, p_active boolean default true)
returns roster_sites
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
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
       and exists (
         select 1 from roster_assignments a join employees e on e.id = a.employee_id
         where a.site_id = p_id
           and (a.valid_to is null or a.valid_to >= v_today)
           and (e.termination_date is null or e.termination_date >= v_today)) then
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
  v_prev roster_assignments;
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

  -- Continuidad: en un "cambio desde una fecha" la asignación anterior se cierra el día previo; lo que se hereda
  -- de ella (sitio, régimen, puesto, cuadrilla) no se vuelve a exigir activo.
  select * into v_prev from roster_assignments x where x.employee_id = v_emp.id and x.valid_to = v_from - 1 order by x.valid_from desc limit 1;

  select * into v_site from roster_sites where id = roster_uuid(p_data ->> 'site_id', 'sitio');
  if v_site.id is null then raise exception 'Sitio no encontrado'; end if;
  if not v_site.active and (v_prev.id is null or v_prev.site_id <> v_site.id) then raise exception 'El sitio está desactivado'; end if;
  select * into v_pat from roster_patterns where id = roster_uuid(p_data ->> 'pattern_id', 'régimen');
  if v_pat.id is null then raise exception 'Régimen no encontrado'; end if;
  if not v_pat.active and (v_prev.id is null or v_prev.pattern_id <> v_pat.id) then raise exception 'El régimen está desactivado'; end if;

  if v_pos_id is not null then
    select * into v_pos from roster_positions where id = v_pos_id;
    if v_pos.id is null or v_pos.site_id <> v_site.id then raise exception 'El puesto no pertenece al sitio elegido'; end if;
    if not v_pos.active and (v_prev.id is null or v_prev.position_id is distinct from v_pos.id) then raise exception 'El puesto está desactivado'; end if;
  end if;
  if v_crew_id is not null then
    select * into v_crew from roster_crews where id = v_crew_id;
    if v_crew.id is null or v_crew.site_id <> v_site.id then raise exception 'La cuadrilla no pertenece al sitio elegido'; end if;
    if not v_crew.active and (v_prev.id is null or v_prev.crew_id is distinct from v_crew.id) then raise exception 'La cuadrilla está desactivada'; end if;
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
  -- Mismo bloqueo que al crear una asignación: así no se superponen dos cambios simultáneos de la misma persona.
  perform 1 from employees where id = v_old.employee_id for update;

  v_pos_id := case when p_data ? 'position_id' then roster_uuid(p_data ->> 'position_id', 'puesto') else v_old.position_id end;
  v_crew_id := case when p_data ? 'crew_id' then roster_uuid(p_data ->> 'crew_id', 'cuadrilla') else v_old.crew_id end;
  v_to := case when p_data ? 'valid_to' then roster_date(p_data ->> 'valid_to', 'Vigente hasta') else v_old.valid_to end;

  if v_to is not null and v_to < v_old.valid_from then raise exception 'La fecha de fin no puede ser anterior al inicio'; end if;
  if v_pos_id is not null then
    select * into v_pos from roster_positions where id = v_pos_id;
    if v_pos.id is null or v_pos.site_id <> v_old.site_id then raise exception 'El puesto no pertenece al sitio de la asignación'; end if;
    if not v_pos.active and v_pos_id is distinct from v_old.position_id then raise exception 'El puesto está desactivado'; end if;
  end if;
  if v_crew_id is not null then
    select * into v_crew from roster_crews where id = v_crew_id;
    if v_crew.id is null or v_crew.site_id <> v_old.site_id then raise exception 'La cuadrilla no pertenece al sitio de la asignación'; end if;
    if not v_crew.active and v_crew_id is distinct from v_old.crew_id then raise exception 'La cuadrilla está desactivada'; end if;
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
  v_cyc int;
  v_idx int;
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
  if p_data ? 'pattern_id' and not (p_data ? 'anchor_date') and (p_data ->> 'pattern_id') <> v_old.pattern_id::text then
    v_data := v_data || jsonb_build_object('anchor_date', p_effective_from);
  end if;
  if p_data ? 'site_id' and (p_data ->> 'site_id') <> v_old.site_id::text then
    if not (p_data ? 'position_id') then v_data := v_data || '{"position_id": null}'::jsonb; end if;
    if not (p_data ? 'crew_id') then v_data := v_data || '{"crew_id": null}'::jsonb; end if;
  end if;

  -- Si el turno alterna y cambia el régimen o el ancla, el ciclo nuevo empieza con el turno que la persona tenía ese día.
  if v_old.alternate_shift and not (p_data ? 'shift')
     and ((p_data ? 'pattern_id' and (p_data ->> 'pattern_id') <> v_old.pattern_id::text) or p_data ? 'anchor_date') then
    select roster_pattern_cycle(p.work_days, p.rest_days, p.travel_in_days, p.travel_out_days, p.travel_inside_cycle)
      into v_cyc from roster_patterns p where p.id = v_old.pattern_id;
    v_idx := ((p_effective_from - v_old.anchor_date) - (((p_effective_from - v_old.anchor_date) % v_cyc) + v_cyc) % v_cyc) / v_cyc;
    if v_idx % 2 <> 0 then
      v_data := v_data || jsonb_build_object('shift', case v_old.shift when 'dia' then 'noche' else 'dia' end);
    end if;
  end if;

  update roster_assignments set valid_to = p_effective_from - 1, updated_at = now(), updated_by = auth.uid() where id = p_id;
  v_new := roster_insert_assignment(v_data);
  perform roster_log('asignacion', p_id, 'cambio', to_jsonb(v_old), to_jsonb(v_new), 'Cambio desde ' || p_effective_from::text);
  return v_new;
end;
$function$;

-- Anula una asignación que todavía no empezó (cargada por error). Las que ya rigen se terminan con fecha de fin.
create or replace function public.roster_void_assignment(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_assignments;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform roster_require();
  select * into v_old from roster_assignments where id = p_id for update;
  if v_old.id is null then raise exception 'Asignación no encontrada'; end if;
  if v_old.valid_from <= v_today then
    raise exception 'Solo se pueden anular asignaciones que todavía no empezaron: terminá esta con una fecha de fin';
  end if;
  delete from roster_assignments where id = p_id;
  perform roster_log('asignacion', p_id, 'anulacion', to_jsonb(v_old), null);
end;
$function$;

revoke execute on function public.roster_void_assignment(uuid) from public, anon;
grant execute on function public.roster_void_assignment(uuid) to authenticated;
