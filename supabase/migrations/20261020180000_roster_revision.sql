-- Roster (Fase 3): correcciones tras la revisión de 20261020160000 y 20261020170000.
-- 1. Guarda en roster_assignments (trigger): no se crea ni se acorta/alarga una asignación dentro de un período cerrado, y
--    no se acorta por debajo de días reales ya registrados (cubre roster_insert/update/change_assignment).
-- 2. roster_void_assignment: si la asignación nació de un «Cambiar desde…», la anterior vuelve a regir (se reabre su fin).
-- 3. roster_close_period: solo períodos que terminaron antes de hoy, y un lock evita dos cierres solapados simultáneos.
-- 4. roster_cost_summary: una fila por persona y MONEDA (antes sumaba monedas distintas); la categoría se compara
--    normalizando espacios.
-- 5. roster_save_pay_rules: shift_hours nulo da un mensaje claro.

-- ---------------------------------------------------------------- 1. guarda en asignaciones
create or replace function public.roster_assignments_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lo date;
  v_hi date;
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from roster_closures c
      where c.reopened_at is null
        and c.date_from <= coalesce(new.valid_to, 'infinity'::date) and c.date_to >= new.valid_from
        and (c.site_id is null or c.site_id = new.site_id)
    ) then
      raise exception 'La asignación toca un período cerrado: reabrilo para cargarla';
    end if;
    return new;
  end if;

  if new.valid_to is distinct from old.valid_to then
    if new.valid_to is not null and exists (select 1 from roster_day_records r where r.assignment_id = new.id and r.day > new.valid_to) then
      raise exception 'La asignación tiene días reales registrados después de esa fecha de fin: no se puede acortar hasta ahí';
    end if;
    v_lo := least(coalesce(old.valid_to, 'infinity'::date), coalesce(new.valid_to, 'infinity'::date));
    v_hi := greatest(coalesce(old.valid_to, 'infinity'::date), coalesce(new.valid_to, 'infinity'::date));
    -- Los días que cambian de estado son (v_lo, v_hi].
    if v_lo < v_hi and exists (
      select 1 from roster_closures c
      where c.reopened_at is null and c.date_to > v_lo and c.date_from <= v_hi
        and (c.site_id is null or c.site_id = new.site_id)
    ) then
      raise exception 'El cambio de la fecha de fin toca un período cerrado: reabrilo primero';
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function public.roster_assignments_guard() from public, anon, authenticated;

drop trigger if exists roster_assignments_guard_insert on public.roster_assignments;
create trigger roster_assignments_guard_insert before insert on public.roster_assignments
  for each row execute function public.roster_assignments_guard();
drop trigger if exists roster_assignments_guard_update on public.roster_assignments;
create trigger roster_assignments_guard_update before update of valid_to on public.roster_assignments
  for each row execute function public.roster_assignments_guard();

-- ---------------------------------------------------------------- 2. anular (restaura la anterior de un «Cambiar desde»)
create or replace function public.roster_void_assignment(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_assignments;
  v_prev roster_assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_restored boolean := false;
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

  -- Si nació de un «Cambiar desde…» (la anterior quedó terminada el día previo), la anterior vuelve a regir hasta donde llegaba esta.
  select * into v_prev from roster_assignments x
  where x.employee_id = v_old.employee_id and x.valid_to = v_old.valid_from - 1 and x.id <> p_id
  order by x.valid_from desc limit 1 for update;
  if v_prev.id is not null and exists (
    select 1 from roster_events e
    where e.entity = 'asignacion' and e.event_type = 'cambio' and e.entity_id = v_prev.id and e.new_value ->> 'id' = p_id::text
  ) then
    v_restored := true;
  end if;

  delete from roster_assignments where id = p_id;
  if v_restored then
    update roster_assignments set valid_to = v_old.valid_to, updated_at = now(), updated_by = auth.uid() where id = v_prev.id;
  end if;
  perform roster_log('asignacion', p_id, 'anulacion', to_jsonb(v_old), null,
                     coalesce(v_reason, '') || case when v_restored then ' (se restauró la asignación anterior)' else '' end);
end;
$function$;

-- ---------------------------------------------------------------- 3. cierre de período
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
  if p_to >= roster_today() then raise exception 'Solo se puede cerrar un período que ya terminó (hasta ayer)'; end if;
  if p_site_id is not null and not exists (select 1 from roster_sites where id = p_site_id) then raise exception 'Sitio no encontrado'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;

  -- Un cierre a la vez: evita que dos cierres solapados pasen juntos el chequeo de superposición.
  perform pg_advisory_xact_lock(hashtext('roster_closures'));
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

-- ---------------------------------------------------------------- 4. costo por persona y moneda
-- Una fila por (persona, moneda). Los días con horas y sin tarifa van en una fila con moneda nula (costo 0).
create or replace function public.roster_cost_summary(p_from date, p_to date, p_site_id uuid default null)
returns table (
  employee_id uuid,
  rate numeric,
  currency text,
  cost numeric,
  days_without_rate integer
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  p roster_pay_rules;
begin
  perform roster_require_rates();
  select * into p from roster_pay_rules limit 1;
  return query
  with s as (
    select a.employee_id, a.day, a.hours_normal, a.hours_extra50, a.hours_extra100, a.hours_travel,
           lower(regexp_replace(btrim(coalesce(e.job_category, '')), '\s+', ' ', 'g')) as cat
    from roster_actual_state(p_from, p_to, p_site_id) a
    join employees e on e.id = a.employee_id
    where a.confirmed and (a.hours_normal + a.hours_extra50 + a.hours_extra100 + a.hours_travel) > 0
  ), priced as (
    select s.*, rt.hourly_rate, rt.currency as cur
    from s
    left join lateral (
      select r.hourly_rate, r.currency
      from roster_rates r
      where r.valid_from <= s.day and (r.valid_to is null or r.valid_to >= s.day)
        and (r.employee_id = s.employee_id or (r.employee_id is null and s.cat <> '' and lower(r.job_category) = s.cat))
      order by (r.employee_id is not null) desc, r.valid_from desc
      limit 1
    ) rt on true
  )
  select pr.employee_id,
         (array_agg(pr.hourly_rate order by pr.day desc) filter (where pr.hourly_rate is not null))[1],
         pr.cur,
         coalesce(sum(pr.hourly_rate * (pr.hours_normal + pr.hours_extra50 * (1 + p.weekday_extra_pct / 100.0)
                                         + pr.hours_extra100 * (1 + p.holiday_extra_pct / 100.0) + pr.hours_travel)), 0),
         (count(*) filter (where pr.hourly_rate is null))::integer
  from priced pr
  group by pr.employee_id, pr.cur
  order by pr.employee_id, pr.cur nulls last;
end;
$function$;

-- ---------------------------------------------------------------- 5. reglas de pago
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
  when check_violation or not_null_violation then raise exception 'Valor fuera de rango o vacío en las reglas de pago o en las horas del turno';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception 'Formato inválido en las reglas de pago';
end;
$function$;
