-- Roster (Fase 3, A+B): corrección de asignaciones y registro REAL contra lo planificado.
-- A. roster_void_assignment: se puede anular una asignación cargada por error aunque ya haya empezado (con motivo),
--    siempre que no tenga días reales registrados ni caiga en un período cerrado.
-- B. Feriados, registros diarios reales (estado + horas), reglas de pago, cierre de período, resumen de horas,
--    excepciones ampliadas (bajada anticipada, subida demorada, capacitación, suspensión, ART) con motivo.
-- El calendario "planificado" sigue calculándose (roster_state); el "real" se arma encima con roster_actual_state.
-- Los recargos y las horas por defecto son PARÁMETROS (roster_pay_rules, roster_rules.shift_hours) a validar con
-- RRHH/contador según el convenio aplicable: no hay valores legales fijos en el código.

-- ---------------------------------------------------------------- auditoría y excepciones ampliadas
alter table public.roster_events drop constraint if exists roster_events_entity_check;
alter table public.roster_events add constraint roster_events_entity_check
  check (entity in ('sitio', 'regimen', 'puesto', 'cuadrilla', 'asignacion', 'excepcion', 'reglas', 'registro', 'cierre', 'feriado', 'pago', 'tarifa'));

alter table public.roster_exceptions drop constraint if exists roster_exceptions_kind_check;
alter table public.roster_exceptions add constraint roster_exceptions_kind_check
  check (kind in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'extension', 'franco_extra',
                  'bajada_anticipada', 'subida_demorada', 'capacitacion', 'suspension', 'accidente_art'));
alter table public.roster_exceptions add column if not exists reason text;
alter table public.roster_exceptions drop constraint if exists roster_exceptions_reason_check;
alter table public.roster_exceptions add constraint roster_exceptions_reason_check
  check (reason is null or reason in ('salud', 'familiar', 'operativa', 'clima', 'disciplinaria', 'otro'));

-- ---------------------------------------------------------------- tablas nuevas
create table public.roster_holidays (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  name text not null,
  scope text not null default 'nacional' check (scope in ('nacional', 'provincial', 'sitio')),
  site_id uuid references public.roster_sites(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roster_holidays_site_check check ((scope = 'sitio') = (site_id is not null))
);
create unique index roster_holidays_key on public.roster_holidays (day, scope, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index roster_holidays_site_idx on public.roster_holidays (site_id);

-- Parámetros de cómo se reparten las horas trabajadas (una sola fila). Horas del turno: roster_rules.shift_hours.
create table public.roster_pay_rules (
  id boolean primary key default true check (id),
  normal_hours_per_day numeric(4, 1) not null default 8 check (normal_hours_per_day between 1 and 24),
  weekday_extra_pct integer not null default 50 check (weekday_extra_pct between 0 and 300),
  holiday_extra_pct integer not null default 100 check (holiday_extra_pct between 0 and 300),
  holiday_all_hours boolean not null default true,
  sunday_as_holiday boolean not null default false,
  travel_day_hours numeric(4, 1) not null default 8 check (travel_day_hours between 0 and 24),
  night_start time not null default '21:00',
  night_end time not null default '06:00',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.roster_pay_rules (id) values (true);

-- Lo que realmente pasó un día. Solo se guarda lo confirmado o corregido: el resto se deriva del plan.
create table public.roster_day_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  day date not null,
  assignment_id uuid not null references public.roster_assignments(id),
  site_id uuid not null references public.roster_sites(id),
  state text not null check (state in ('trabajo', 'franco', 'viaje_subida', 'viaje_bajada', 'vacaciones', 'licencia', 'enfermedad',
                                       'ausencia', 'bajada_anticipada', 'subida_demorada', 'capacitacion', 'suspension', 'accidente_art')),
  shift text check (shift in ('dia', 'noche')),
  hours_normal numeric(5, 2) not null default 0 check (hours_normal between 0 and 24),
  hours_extra50 numeric(5, 2) not null default 0 check (hours_extra50 between 0 and 24),
  hours_extra100 numeric(5, 2) not null default 0 check (hours_extra100 between 0 and 24),
  hours_night numeric(5, 2) not null default 0 check (hours_night between 0 and 24),
  hours_travel numeric(5, 2) not null default 0 check (hours_travel between 0 and 24),
  reason text check (reason is null or reason in ('salud', 'familiar', 'operativa', 'clima', 'disciplinaria', 'otro')),
  note text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_day_records_hours_check check (hours_normal + hours_extra50 + hours_extra100 + hours_travel <= 24),
  constraint roster_day_records_night_check check (hours_night <= hours_normal + hours_extra50 + hours_extra100)
);
create unique index roster_day_records_key on public.roster_day_records (employee_id, day);
create index roster_day_records_day_idx on public.roster_day_records (day);
create index roster_day_records_assignment_idx on public.roster_day_records (assignment_id);
create index roster_day_records_site_idx on public.roster_day_records (site_id);

-- Período cerrado (liquidado): no se editan registros, excepciones ni asignaciones que lo toquen hasta reabrirlo.
create table public.roster_closures (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  site_id uuid references public.roster_sites(id),
  note text,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz not null default now(),
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  reopen_reason text,
  constraint roster_closures_dates_check check (date_to >= date_from)
);
create index roster_closures_open_idx on public.roster_closures (date_from, date_to) where reopened_at is null;
create index roster_closures_site_idx on public.roster_closures (site_id);

do $$
declare
  t text;
begin
  foreach t in array array['roster_holidays', 'roster_pay_rules', 'roster_day_records', 'roster_closures'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select has_module(%L)))',
      t || '_staff_select', t, 'roster');
  end loop;
end $$;

-- ---------------------------------------------------------------- helpers internos (sin acceso directo)
-- Punto único para quién puede ESCRIBIR registros reales: hoy, quien tiene el módulo (más adelante, supervisores).
create or replace function public.roster_require_write()
returns void
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform roster_require();
end;
$function$;

create or replace function public.roster_today()
returns date
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$function$;

create or replace function public.roster_day_closed(p_day date, p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from roster_closures c
    where c.reopened_at is null and p_day between c.date_from and c.date_to
      and (c.site_id is null or c.site_id = p_site_id));
$function$;

-- Horas con hasta 2 decimales, entre 0 y 24. Vacío = null.
create or replace function public.roster_hours(p_text text, p_label text)
returns numeric
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $function$
declare
  t text := nullif(btrim(coalesce(p_text, '')), '');
  n numeric;
begin
  if t is null then return null; end if;
  if t !~ '^[0-9]{1,2}([.][0-9]{1,2})?$' then raise exception 'Horas inválidas en %: %', p_label, t; end if;
  n := t::numeric;
  if n > 24 then raise exception 'El valor de % no puede superar 24 horas', p_label; end if;
  return n;
end;
$function$;

-- Reparto de horas de un día según el estado, las reglas de pago y si es feriado.
-- Trabajo/capacitación: horas del turno (roster_rules.shift_hours); hasta normal_hours_per_day son normales y el resto
-- recargo de día hábil; en feriado (o domingo si así se configura) van al recargo de feriado. Viaje: horas de viaje.
create or replace function public.roster_default_hours(p_day date, p_state text, p_shift text, p_holiday boolean)
returns table (h_normal numeric, h_extra50 numeric, h_extra100 numeric, h_night numeric, h_travel numeric)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r roster_rules;
  p roster_pay_rules;
  h numeric;
  rest_day boolean;
begin
  h_normal := 0; h_extra50 := 0; h_extra100 := 0; h_night := 0; h_travel := 0;
  select * into r from roster_rules limit 1;
  select * into p from roster_pay_rules limit 1;
  if p_state in ('trabajo', 'capacitacion') then
    h := r.shift_hours;
    rest_day := coalesce(p_holiday, false) or (p.sunday_as_holiday and extract(dow from p_day) = 0);
    if rest_day and p.holiday_all_hours then
      h_extra100 := h;
    elsif rest_day then
      h_normal := least(h, p.normal_hours_per_day);
      h_extra100 := h - h_normal;
    else
      h_normal := least(h, p.normal_hours_per_day);
      h_extra50 := h - h_normal;
    end if;
    if p_shift = 'noche' then h_night := h; end if;
  elsif p_state in ('viaje_subida', 'viaje_bajada') then
    h_travel := p.travel_day_hours;
  end if;
  return next;
end;
$function$;

revoke execute on function public.roster_require_write() from public, anon, authenticated;
revoke execute on function public.roster_today() from public, anon, authenticated;
revoke execute on function public.roster_day_closed(date, uuid) from public, anon, authenticated;
revoke execute on function public.roster_hours(text, text) from public, anon, authenticated;
revoke execute on function public.roster_default_hours(date, text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- lectura: plan (con estado base) y real
-- roster_state ahora devuelve también base_state (lo que dice el ciclo, sin excepciones) y entiende las excepciones nuevas.
drop function if exists public.roster_state(date, date, uuid);
create function public.roster_state(p_from date, p_to date, p_site_id uuid default null)
returns table (
  employee_id uuid,
  assignment_id uuid,
  site_id uuid,
  crew_id uuid,
  position_id uuid,
  day date,
  state text,
  shift text,
  extended boolean,
  base_state text
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
      order by (x.kind in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'bajada_anticipada', 'subida_demorada', 'suspension', 'accidente_art')) desc,
               x.created_at desc
      limit 1
    ) ex on true
  )
  select c.employee_id, c.assignment_id, c.site_id, c.crew_id, c.position_id, c.day,
         s.state,
         case when s.state in ('trabajo', 'capacitacion') then c.eff_shift else null end,
         coalesce(c.ex_kind = 'extension' and s.state = 'trabajo', false),
         c.base_state
  from c
  cross join lateral (
    select case
             when c.ex_kind in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'bajada_anticipada', 'subida_demorada',
                                'capacitacion', 'suspension', 'accidente_art') then c.ex_kind
             when c.ex_kind = 'extension' then 'trabajo'
             when c.ex_kind = 'franco_extra' then 'franco'
             else c.base_state end as state
  ) s
  order by c.employee_id, c.day;
end;
$function$;

revoke execute on function public.roster_state(date, date, uuid) from public, anon;
grant execute on function public.roster_state(date, date, uuid) to authenticated;

-- Calendario real: el plan (ciclo + excepciones) pisado por lo registrado. Sin registro, estado y horas son las del plan
-- y confirmed = false. differs = el registro no coincide con el plan (estado, turno u horas).
create or replace function public.roster_actual_state(p_from date, p_to date, p_site_id uuid default null)
returns table (
  employee_id uuid,
  assignment_id uuid,
  site_id uuid,
  crew_id uuid,
  position_id uuid,
  day date,
  base_state text,
  plan_state text,
  plan_shift text,
  extended boolean,
  state text,
  shift text,
  confirmed boolean,
  hours_normal numeric,
  hours_extra50 numeric,
  hours_extra100 numeric,
  hours_night numeric,
  hours_travel numeric,
  is_holiday boolean,
  holiday_name text,
  reason text,
  note text,
  differs boolean,
  closed boolean
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  perform roster_require();
  return query
  select s.employee_id, s.assignment_id, s.site_id, s.crew_id, s.position_id, s.day,
         s.base_state, s.state, s.shift, s.extended,
         coalesce(r.state, s.state),
         case when r.id is not null then r.shift else s.shift end,
         r.id is not null,
         coalesce(r.hours_normal, d.h_normal), coalesce(r.hours_extra50, d.h_extra50), coalesce(r.hours_extra100, d.h_extra100),
         coalesce(r.hours_night, d.h_night), coalesce(r.hours_travel, d.h_travel),
         hol.name is not null, hol.name, r.reason, r.note,
         coalesce(r.id is not null and (
           r.state <> s.state or r.shift is distinct from s.shift
           or (r.hours_normal, r.hours_extra50, r.hours_extra100, r.hours_travel)
              is distinct from (d.h_normal, d.h_extra50, d.h_extra100, d.h_travel)), false),
         roster_day_closed(s.day, s.site_id)
  from roster_state(p_from, p_to, p_site_id) s
  left join roster_day_records r on r.employee_id = s.employee_id and r.day = s.day
  left join lateral (
    select h.name from roster_holidays h
    where h.active and h.day = s.day and (h.site_id is null or h.site_id = s.site_id)
    order by (h.site_id is null)
    limit 1
  ) hol on true
  cross join lateral roster_default_hours(s.day, s.state, s.shift, hol.name is not null) d
  order by s.employee_id, s.day;
end;
$function$;

-- Resumen por persona de lo CONFIRMADO en el período (insumo de la liquidación). Máx. 62 días.
create or replace function public.roster_hours_summary(p_from date, p_to date, p_site_id uuid default null)
returns table (
  employee_id uuid,
  last_name text,
  first_name text,
  legajo text,
  site_names text,
  crew_name text,
  days_worked integer,
  days_travel integer,
  days_rest integer,
  days_vacation integer,
  days_license integer,
  days_sick integer,
  days_absent integer,
  days_other integer,
  days_unconfirmed integer,
  days_holiday_worked integer,
  hours_normal numeric,
  hours_extra50 numeric,
  hours_extra100 numeric,
  hours_night numeric,
  hours_travel numeric,
  hours_total numeric
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_today date := roster_today();
begin
  perform roster_require();
  return query
  select s.employee_id, e.last_name, e.first_name, e.legajo,
         string_agg(distinct si.name, ', '),
         (array_agg(c.name order by s.day desc) filter (where c.name is not null))[1],
         (count(*) filter (where s.confirmed and s.state in ('trabajo', 'capacitacion')))::integer,
         (count(*) filter (where s.confirmed and s.state in ('viaje_subida', 'viaje_bajada')))::integer,
         (count(*) filter (where s.confirmed and s.state = 'franco'))::integer,
         (count(*) filter (where s.confirmed and s.state = 'vacaciones'))::integer,
         (count(*) filter (where s.confirmed and s.state = 'licencia'))::integer,
         (count(*) filter (where s.confirmed and s.state in ('enfermedad', 'accidente_art')))::integer,
         (count(*) filter (where s.confirmed and s.state in ('ausencia', 'suspension')))::integer,
         (count(*) filter (where s.confirmed and s.state in ('bajada_anticipada', 'subida_demorada')))::integer,
         (count(*) filter (where not s.confirmed and s.day <= v_today and s.state <> 'franco'))::integer,
         (count(*) filter (where s.confirmed and s.state in ('trabajo', 'capacitacion') and s.is_holiday))::integer,
         coalesce(sum(s.hours_normal) filter (where s.confirmed), 0),
         coalesce(sum(s.hours_extra50) filter (where s.confirmed), 0),
         coalesce(sum(s.hours_extra100) filter (where s.confirmed), 0),
         coalesce(sum(s.hours_night) filter (where s.confirmed), 0),
         coalesce(sum(s.hours_travel) filter (where s.confirmed), 0),
         coalesce(sum(s.hours_normal + s.hours_extra50 + s.hours_extra100 + s.hours_travel) filter (where s.confirmed), 0)
  from roster_actual_state(p_from, p_to, p_site_id) s
  join employees e on e.id = s.employee_id
  join roster_sites si on si.id = s.site_id
  left join roster_crews c on c.id = s.crew_id
  group by s.employee_id, e.last_name, e.first_name, e.legajo
  order by e.last_name, e.first_name, s.employee_id;
end;
$function$;

-- ---------------------------------------------------------------- registros reales
create or replace function public.roster_save_day_record(p_employee_id uuid, p_day date, p_data jsonb)
returns roster_day_records
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_emp employees;
  v_asg roster_assignments;
  v_old roster_day_records;
  v_row roster_day_records;
  v_state text;
  v_shift text;
  v_reason text;
  v_note text;
  v_holiday boolean;
  d record;
  v_n numeric;
  v_e50 numeric;
  v_e100 numeric;
  v_night numeric;
  v_trav numeric;
begin
  perform roster_require_write();
  if p_day is null then raise exception 'La fecha es obligatoria'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  if (p_data - 'state' - 'shift' - 'hours_normal' - 'hours_extra50' - 'hours_extra100' - 'hours_night' - 'hours_travel' - 'reason' - 'note') <> '{}'::jsonb then
    raise exception 'Datos del registro inválidos';
  end if;
  if p_day > roster_today() then raise exception 'No se puede registrar un día que todavía no pasó (para eventos futuros usá las excepciones)'; end if;

  select * into v_emp from employees where id = p_employee_id for update;
  if v_emp.id is null then raise exception 'Empleado no encontrado'; end if;
  if v_emp.termination_date is not null and p_day > v_emp.termination_date then
    raise exception 'La persona estaba dada de baja ese día';
  end if;

  select * into v_asg from roster_assignments a
  where a.employee_id = p_employee_id and p_day between a.valid_from and coalesce(a.valid_to, 'infinity'::date)
  order by a.valid_from desc limit 1;
  if v_asg.id is null then raise exception 'La persona no tiene una asignación vigente ese día'; end if;
  if roster_day_closed(p_day, v_asg.site_id) then raise exception 'Ese día pertenece a un período cerrado: reabrilo para modificarlo'; end if;

  v_state := coalesce(nullif(p_data ->> 'state', ''), 'trabajo');
  if v_state not in ('trabajo', 'franco', 'viaje_subida', 'viaje_bajada', 'vacaciones', 'licencia', 'enfermedad', 'ausencia',
                     'bajada_anticipada', 'subida_demorada', 'capacitacion', 'suspension', 'accidente_art') then
    raise exception 'Estado inválido';
  end if;
  v_shift := nullif(p_data ->> 'shift', '');
  if v_shift is not null and v_shift not in ('dia', 'noche') then raise exception 'Turno inválido'; end if;
  if v_state not in ('trabajo', 'capacitacion') then v_shift := null; end if;
  v_reason := nullif(p_data ->> 'reason', '');
  if v_reason is not null and v_reason not in ('salud', 'familiar', 'operativa', 'clima', 'disciplinaria', 'otro') then raise exception 'Motivo inválido'; end if;
  v_note := nullif(btrim(coalesce(p_data ->> 'note', '')), '');
  if length(coalesce(v_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;

  select exists (
    select 1 from roster_holidays h where h.active and h.day = p_day and (h.site_id is null or h.site_id = v_asg.site_id)
  ) into v_holiday;
  select * into d from roster_default_hours(p_day, v_state, coalesce(v_shift, v_asg.shift), v_holiday);

  v_n := coalesce(roster_hours(p_data ->> 'hours_normal', 'horas normales'), d.h_normal);
  v_e50 := coalesce(roster_hours(p_data ->> 'hours_extra50', 'horas extra 50%'), d.h_extra50);
  v_e100 := coalesce(roster_hours(p_data ->> 'hours_extra100', 'horas extra 100%'), d.h_extra100);
  v_night := coalesce(roster_hours(p_data ->> 'hours_night', 'horas nocturnas'), d.h_night);
  v_trav := coalesce(roster_hours(p_data ->> 'hours_travel', 'horas de viaje'), d.h_travel);

  if v_state not in ('trabajo', 'capacitacion', 'viaje_subida', 'viaje_bajada') and (v_n + v_e50 + v_e100 + v_trav + v_night) > 0 then
    raise exception 'Ese estado no lleva horas';
  end if;
  if v_n + v_e50 + v_e100 + v_trav > 24 then raise exception 'Las horas del día no pueden superar 24'; end if;
  if v_night > v_n + v_e50 + v_e100 then raise exception 'Las horas nocturnas no pueden superar las horas trabajadas'; end if;

  select * into v_old from roster_day_records where employee_id = p_employee_id and day = p_day;

  insert into roster_day_records (employee_id, day, assignment_id, site_id, state, shift, hours_normal, hours_extra50,
                                  hours_extra100, hours_night, hours_travel, reason, note, created_by, updated_by)
  values (p_employee_id, p_day, v_asg.id, v_asg.site_id, v_state, v_shift, v_n, v_e50, v_e100, v_night, v_trav, v_reason, v_note,
          auth.uid(), auth.uid())
  on conflict (employee_id, day) do update
    set assignment_id = excluded.assignment_id, site_id = excluded.site_id, state = excluded.state, shift = excluded.shift,
        hours_normal = excluded.hours_normal, hours_extra50 = excluded.hours_extra50, hours_extra100 = excluded.hours_extra100,
        hours_night = excluded.hours_night, hours_travel = excluded.hours_travel, reason = excluded.reason, note = excluded.note,
        updated_by = auth.uid(), updated_at = now()
  returning * into v_row;

  perform roster_log('registro', v_row.id, case when v_old.id is null then 'alta' else 'edicion' end,
                     case when v_old.id is null then null else to_jsonb(v_old) end, to_jsonb(v_row));
  return v_row;
end;
$function$;

-- Quita la corrección: ese día vuelve a derivarse del plan.
create or replace function public.roster_delete_day_record(p_employee_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_day_records;
begin
  perform roster_require_write();
  select * into v_old from roster_day_records where employee_id = p_employee_id and day = p_day for update;
  if v_old.id is null then raise exception 'Ese día no tiene un registro'; end if;
  if roster_day_closed(p_day, v_old.site_id) then raise exception 'Ese día pertenece a un período cerrado: reabrilo para modificarlo'; end if;
  delete from roster_day_records where id = v_old.id;
  perform roster_log('registro', v_old.id, 'baja', to_jsonb(v_old), null);
end;
$function$;

-- "Trabajaron como estaba planificado": confirma de a muchos los días SIN registro (estado y horas del plan).
-- Solo días que ya pasaron; saltea los períodos cerrados. Después se corrigen solo los desvíos.
create or replace function public.roster_confirm_range(
  p_from date,
  p_to date,
  p_site_id uuid,
  p_crew_id uuid default null,
  p_employee_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n integer;
begin
  perform roster_require_write();
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rango de fechas inválido'; end if;
  if p_to - p_from > 61 then raise exception 'El rango no puede superar los 62 días'; end if;
  if p_to > roster_today() then raise exception 'Solo se pueden confirmar días que ya pasaron (hasta hoy)'; end if;
  if p_site_id is null or not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Sitio no encontrado'; end if;

  with todo as (
    select s.employee_id, s.assignment_id, s.site_id, s.day, s.state, s.shift
    from roster_state(p_from, p_to, p_site_id) s
    where (p_crew_id is null or s.crew_id = p_crew_id)
      and (p_employee_ids is null or s.employee_id = any (p_employee_ids))
      and not exists (select 1 from roster_day_records r where r.employee_id = s.employee_id and r.day = s.day)
      and not roster_day_closed(s.day, s.site_id)
  ), ins as (
    insert into roster_day_records (employee_id, day, assignment_id, site_id, state, shift, hours_normal, hours_extra50,
                                    hours_extra100, hours_night, hours_travel, created_by, updated_by)
    select t.employee_id, t.day, t.assignment_id, t.site_id, t.state, t.shift,
           d.h_normal, d.h_extra50, d.h_extra100, d.h_night, d.h_travel, auth.uid(), auth.uid()
    from todo t
    cross join lateral roster_default_hours(
      t.day, t.state, t.shift,
      exists (select 1 from roster_holidays h where h.active and h.day = t.day and (h.site_id is null or h.site_id = t.site_id))) d
    on conflict (employee_id, day) do nothing
    returning 1
  )
  select count(*) into v_n from ins;

  perform roster_log('registro', null, 'confirmacion', null,
                     jsonb_build_object('desde', p_from, 'hasta', p_to, 'sitio', p_site_id, 'cuadrilla', p_crew_id, 'dias', v_n),
                     'Confirmados ' || v_n || ' días como planificado');
  return v_n;
end;
$function$;

-- ---------------------------------------------------------------- feriados y reglas
create or replace function public.roster_save_holiday(p_id uuid, p_day date, p_name text, p_scope text default 'nacional', p_site_id uuid default null, p_active boolean default true)
returns roster_holidays
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_old roster_holidays;
  v_row roster_holidays;
begin
  perform roster_require();
  if p_day is null or p_day < date '2000-01-01' or p_day > date '2100-01-01' then raise exception 'Fecha de feriado inválida'; end if;
  if v_name is null then raise exception 'El nombre del feriado es obligatorio'; end if;
  if length(v_name) > 120 then raise exception 'Nombre demasiado largo'; end if;
  if p_scope is null or p_scope not in ('nacional', 'provincial', 'sitio') then raise exception 'Alcance inválido'; end if;
  if p_scope = 'sitio' and not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Elegí el sitio del feriado'; end if;
  if p_scope <> 'sitio' and p_site_id is not null then raise exception 'Solo los feriados de sitio llevan sitio'; end if;

  if p_id is null then
    insert into roster_holidays (day, name, scope, site_id, active) values (p_day, v_name, p_scope, p_site_id, coalesce(p_active, true)) returning * into v_row;
    perform roster_log('feriado', v_row.id, 'alta', null, to_jsonb(v_row));
  else
    select * into v_old from roster_holidays where id = p_id for update;
    if v_old.id is null then raise exception 'Feriado no encontrado'; end if;
    update roster_holidays set day = p_day, name = v_name, scope = p_scope, site_id = p_site_id, active = coalesce(p_active, true)
    where id = p_id returning * into v_row;
    perform roster_log('feriado', p_id, 'edicion', to_jsonb(v_old), to_jsonb(v_row));
  end if;
  return v_row;
exception when unique_violation then
  raise exception 'Ya hay un feriado cargado ese día con ese alcance';
end;
$function$;

create or replace function public.roster_delete_holiday(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_holidays;
begin
  perform roster_require();
  delete from roster_holidays where id = p_id returning * into v_old;
  if v_old.id is null then raise exception 'Feriado no encontrado'; end if;
  perform roster_log('feriado', p_id, 'baja', to_jsonb(v_old), null);
end;
$function$;

-- Reglas de reparto de horas (roster_pay_rules) y horas del turno (roster_rules.shift_hours). Solo cambian lo que viene en p_data.
create or replace function public.roster_save_pay_rules(p_data jsonb)
returns roster_pay_rules
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_pay_rules;
  v_row roster_pay_rules;
  v_old_rules roster_rules;
begin
  perform roster_require();
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  if (p_data - 'normal_hours_per_day' - 'weekday_extra_pct' - 'holiday_extra_pct' - 'holiday_all_hours' - 'sunday_as_holiday'
             - 'travel_day_hours' - 'night_start' - 'night_end' - 'shift_hours') <> '{}'::jsonb then
    raise exception 'Datos de las reglas inválidos';
  end if;

  select * into v_old from roster_pay_rules where id for update;
  update roster_pay_rules set
    normal_hours_per_day = case when p_data ? 'normal_hours_per_day' then roster_hours(p_data ->> 'normal_hours_per_day', 'horas normales por día') else normal_hours_per_day end,
    weekday_extra_pct = case when p_data ? 'weekday_extra_pct' then (p_data ->> 'weekday_extra_pct')::integer else weekday_extra_pct end,
    holiday_extra_pct = case when p_data ? 'holiday_extra_pct' then (p_data ->> 'holiday_extra_pct')::integer else holiday_extra_pct end,
    holiday_all_hours = case when p_data ? 'holiday_all_hours' then (p_data ->> 'holiday_all_hours')::boolean else holiday_all_hours end,
    sunday_as_holiday = case when p_data ? 'sunday_as_holiday' then (p_data ->> 'sunday_as_holiday')::boolean else sunday_as_holiday end,
    travel_day_hours = case when p_data ? 'travel_day_hours' then roster_hours(p_data ->> 'travel_day_hours', 'horas del día de viaje') else travel_day_hours end,
    night_start = case when p_data ? 'night_start' then (p_data ->> 'night_start')::time else night_start end,
    night_end = case when p_data ? 'night_end' then (p_data ->> 'night_end')::time else night_end end,
    updated_by = auth.uid(), updated_at = now()
  where id returning * into v_row;
  perform roster_log('pago', null, 'edicion', to_jsonb(v_old), to_jsonb(v_row));

  if p_data ? 'shift_hours' then
    select * into v_old_rules from roster_rules where id for update;
    update roster_rules set shift_hours = (p_data ->> 'shift_hours')::integer, updated_by = auth.uid(), updated_at = now() where id;
    perform roster_log('reglas', null, 'edicion', jsonb_build_object('shift_hours', v_old_rules.shift_hours), jsonb_build_object('shift_hours', (p_data ->> 'shift_hours')::integer));
  end if;
  return v_row;
exception
  when check_violation then raise exception 'Valor fuera de rango en las reglas de pago o en las horas del turno';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'Formato inválido en las reglas de pago';
end;
$function$;

-- ---------------------------------------------------------------- cierre de período
create or replace function public.roster_close_period(p_from date, p_to date, p_site_id uuid default null, p_note text default null)
returns roster_closures
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row roster_closures;
  v_pending integer;
begin
  perform roster_require_write();
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rango de fechas inválido'; end if;
  if p_to - p_from > 61 then raise exception 'El período no puede superar los 62 días'; end if;
  if p_to > roster_today() then raise exception 'No se puede cerrar un período que todavía no terminó'; end if;
  if p_site_id is not null and not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Sitio no encontrado'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;
  if exists (
    select 1 from roster_closures c
    where c.reopened_at is null and c.date_from <= p_to and c.date_to >= p_from
      and (c.site_id is null or p_site_id is null or c.site_id = p_site_id)
  ) then
    raise exception 'El período se superpone con otro ya cerrado';
  end if;

  select count(*) into v_pending
  from roster_actual_state(p_from, p_to, p_site_id) s
  where not s.confirmed and s.state <> 'franco';
  if v_pending > 0 then
    raise exception 'Hay % días sin confirmar en el período: confirmalos (o corregilos) antes de cerrarlo', v_pending;
  end if;

  insert into roster_closures (date_from, date_to, site_id, note, closed_by)
  values (p_from, p_to, p_site_id, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into v_row;
  perform roster_log('cierre', v_row.id, 'cierre', null, to_jsonb(v_row));
  return v_row;
end;
$function$;

create or replace function public.roster_reopen_period(p_id uuid, p_reason text)
returns roster_closures
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_closures;
  v_row roster_closures;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform roster_require_write();
  if v_reason is null then raise exception 'Indicá el motivo de la reapertura'; end if;
  if length(v_reason) > 500 then raise exception 'El motivo es demasiado largo (máximo 500 caracteres)'; end if;
  select * into v_old from roster_closures where id = p_id for update;
  if v_old.id is null then raise exception 'Cierre no encontrado'; end if;
  if v_old.reopened_at is not null then raise exception 'Ese período ya estaba reabierto'; end if;
  update roster_closures set reopened_at = now(), reopened_by = auth.uid(), reopen_reason = v_reason where id = p_id returning * into v_row;
  perform roster_log('cierre', p_id, 'reapertura', to_jsonb(v_old), to_jsonb(v_row), v_reason);
  return v_row;
end;
$function$;

-- ---------------------------------------------------------------- excepciones: motivo y período cerrado
drop function if exists public.roster_add_exception(uuid, text, date, date, text, uuid);
create function public.roster_add_exception(
  p_employee_id uuid,
  p_kind text,
  p_from date,
  p_to date,
  p_note text default null,
  p_covers_employee_id uuid default null,
  p_reason text default null
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
  if p_kind is null or p_kind not in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'extension', 'franco_extra',
                                      'bajada_anticipada', 'subida_demorada', 'capacitacion', 'suspension', 'accidente_art') then
    raise exception 'Tipo de excepción inválido';
  end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Fechas inválidas: el fin no puede ser anterior al inicio'; end if;
  if p_to - p_from > 365 then raise exception 'Una excepción no puede durar más de un año'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;
  if p_reason is not null and p_reason not in ('salud', 'familiar', 'operativa', 'clima', 'disciplinaria', 'otro') then raise exception 'Motivo inválido'; end if;
  if not exists (select 1 from employees where id = p_employee_id) then raise exception 'Empleado no encontrado'; end if;
  if p_covers_employee_id is not null and not exists (select 1 from employees where id = p_covers_employee_id) then
    raise exception 'La persona a la que reemplaza no existe';
  end if;
  if p_covers_employee_id = p_employee_id then raise exception 'Una persona no puede reemplazarse a sí misma'; end if;
  if exists (select 1 from roster_closures c where c.reopened_at is null and c.date_from <= p_to and c.date_to >= p_from) then
    raise exception 'Las fechas tocan un período cerrado: reabrilo o cargá la excepción fuera de ese período';
  end if;

  insert into roster_exceptions (employee_id, kind, date_from, date_to, note, covers_employee_id, reason, created_by)
  values (p_employee_id, p_kind, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), p_covers_employee_id, nullif(p_reason, ''), auth.uid())
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
  select * into v_old from roster_exceptions where id = p_id for update;
  if v_old.id is null then raise exception 'Excepción no encontrada'; end if;
  if exists (select 1 from roster_closures c where c.reopened_at is null and c.date_from <= v_old.date_to and c.date_to >= v_old.date_from) then
    raise exception 'La excepción toca un período cerrado: reabrilo para quitarla';
  end if;
  delete from roster_exceptions where id = p_id;
  perform roster_log('excepcion', p_id, 'baja', to_jsonb(v_old), null);
end;
$function$;

-- ---------------------------------------------------------------- anular asignaciones (A)
drop function if exists public.roster_void_assignment(uuid);
create function public.roster_void_assignment(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform roster_require();
  if length(coalesce(v_reason, '')) > 500 then raise exception 'El motivo es demasiado largo (máximo 500 caracteres)'; end if;
  select * into v_old from roster_assignments where id = p_id for update;
  if v_old.id is null then raise exception 'Asignación no encontrada'; end if;
  perform 1 from employees where id = v_old.employee_id for update;

  if v_old.valid_from <= roster_today() and v_reason is null then
    raise exception 'Indicá el motivo de la anulación (la asignación ya empezó)';
  end if;
  if exists (select 1 from roster_day_records r where r.assignment_id = p_id) then
    raise exception 'Ya tiene días reales registrados: no se puede anular. Terminala con una fecha de fin';
  end if;
  if exists (
    select 1 from roster_closures c
    where c.reopened_at is null and c.date_from <= coalesce(v_old.valid_to, 'infinity'::date) and c.date_to >= v_old.valid_from
      and (c.site_id is null or c.site_id = v_old.site_id)
  ) then
    raise exception 'La asignación toca un período cerrado: reabrilo para anularla';
  end if;

  delete from roster_assignments where id = p_id;
  perform roster_log('asignacion', p_id, 'anulacion', to_jsonb(v_old), null, v_reason);
end;
$function$;

-- ---------------------------------------------------------------- permisos
revoke execute on function public.roster_actual_state(date, date, uuid) from public, anon;
revoke execute on function public.roster_hours_summary(date, date, uuid) from public, anon;
revoke execute on function public.roster_save_day_record(uuid, date, jsonb) from public, anon;
revoke execute on function public.roster_delete_day_record(uuid, date) from public, anon;
revoke execute on function public.roster_confirm_range(date, date, uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.roster_save_holiday(uuid, date, text, text, uuid, boolean) from public, anon;
revoke execute on function public.roster_delete_holiday(uuid) from public, anon;
revoke execute on function public.roster_save_pay_rules(jsonb) from public, anon;
revoke execute on function public.roster_close_period(date, date, uuid, text) from public, anon;
revoke execute on function public.roster_reopen_period(uuid, text) from public, anon;
revoke execute on function public.roster_add_exception(uuid, text, date, date, text, uuid, text) from public, anon;
revoke execute on function public.roster_delete_exception(uuid) from public, anon;
revoke execute on function public.roster_void_assignment(uuid, text) from public, anon;

grant execute on function public.roster_actual_state(date, date, uuid) to authenticated;
grant execute on function public.roster_hours_summary(date, date, uuid) to authenticated;
grant execute on function public.roster_save_day_record(uuid, date, jsonb) to authenticated;
grant execute on function public.roster_delete_day_record(uuid, date) to authenticated;
grant execute on function public.roster_confirm_range(date, date, uuid, uuid, uuid[]) to authenticated;
grant execute on function public.roster_save_holiday(uuid, date, text, text, uuid, boolean) to authenticated;
grant execute on function public.roster_delete_holiday(uuid) to authenticated;
grant execute on function public.roster_save_pay_rules(jsonb) to authenticated;
grant execute on function public.roster_close_period(date, date, uuid, text) to authenticated;
grant execute on function public.roster_reopen_period(uuid, text) to authenticated;
grant execute on function public.roster_add_exception(uuid, text, date, date, text, uuid, text) to authenticated;
grant execute on function public.roster_delete_exception(uuid) to authenticated;
grant execute on function public.roster_void_assignment(uuid, text) to authenticated;
