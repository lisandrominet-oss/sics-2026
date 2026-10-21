-- Roster (Fase 3, C): precios por hora y costo de lo trabajado.
-- La tarifa se guarda con vigencia (historial): una nueva "desde" cierra la anterior el día previo, nunca se pisa.
-- Hay tarifa por EMPLEADO (pisa) o por CATEGORÍA (employees.job_category). El costo no se guarda: se calcula sobre los
-- días CONFIRMADOS (roster_day_records) con la tarifa vigente ese día y los recargos de roster_pay_rules.
-- Decisión del negocio: cualquiera con el módulo Roster ve y carga las tarifas (policy y funciones con has_module('roster')).
-- Si más adelante se restringe, alcanza con cambiar roster_require_rates() y la policy de roster_rates.

create table public.roster_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  job_category text,
  hourly_rate numeric(14, 2) not null check (hourly_rate > 0),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  valid_from date not null,
  valid_to date,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint roster_rates_target_check check ((employee_id is null) <> (job_category is null)),
  constraint roster_rates_dates_check check (valid_to is null or valid_to >= valid_from)
);
create index roster_rates_employee_idx on public.roster_rates (employee_id, valid_from);
create index roster_rates_category_idx on public.roster_rates (lower(job_category), valid_from);

alter table public.roster_rates enable row level security;
create policy roster_rates_staff_select on public.roster_rates for select to authenticated using ((select has_module('roster')));

-- Punto único de permiso para tarifas (hoy, el módulo Roster).
create or replace function public.roster_require_rates()
returns void
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform roster_require();
end;
$function$;

revoke execute on function public.roster_require_rates() from public, anon, authenticated;

-- Categorías de empleados existentes (los usuarios del roster no leen employees).
create or replace function public.roster_job_categories()
returns table (job_category text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  perform roster_require_rates();
  return query
  select distinct e.job_category from employees e where e.job_category is not null and e.status <> 'baja' order by 1;
end;
$function$;

create or replace function public.roster_rates_list()
returns table (
  id uuid,
  employee_id uuid,
  last_name text,
  first_name text,
  legajo text,
  job_category text,
  hourly_rate numeric,
  currency text,
  valid_from date,
  valid_to date,
  note text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  perform roster_require_rates();
  return query
  select r.id, r.employee_id, e.last_name, e.first_name, e.legajo, r.job_category, r.hourly_rate, r.currency, r.valid_from, r.valid_to, r.note
  from roster_rates r
  left join employees e on e.id = r.employee_id
  order by coalesce(lower(r.job_category), ''), e.last_name, e.first_name, r.valid_from desc, r.id;
end;
$function$;

-- Alta de una tarifa "desde" una fecha: cierra la vigente el día anterior (tiene que ser posterior a su inicio).
create or replace function public.roster_save_rate(
  p_employee_id uuid,
  p_job_category text,
  p_rate numeric,
  p_currency text,
  p_from date,
  p_note text default null
)
returns roster_rates
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cat text := nullif(regexp_replace(btrim(coalesce(p_job_category, '')), '\s+', ' ', 'g'), '');
  v_prev roster_rates;
  v_row roster_rates;
begin
  perform roster_require_rates();
  if (p_employee_id is null) = (v_cat is null) then raise exception 'La tarifa es de una persona o de una categoría (una sola)'; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'El precio por hora tiene que ser mayor a cero'; end if;
  if p_rate >= 1000000000 then raise exception 'El precio por hora es demasiado alto'; end if;
  if p_currency is null or p_currency not in ('ARS', 'USD') then raise exception 'Moneda inválida'; end if;
  if p_from is null or p_from < date '2000-01-01' or p_from > date '2100-01-01' then raise exception 'La fecha de vigencia es obligatoria'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'La nota es demasiado larga (máximo 500 caracteres)'; end if;
  if v_cat is not null and length(v_cat) > 120 then raise exception 'Categoría demasiado larga'; end if;

  if p_employee_id is not null then
    perform 1 from employees where id = p_employee_id for update;
    if not found then raise exception 'Empleado no encontrado'; end if;
    select * into v_prev from roster_rates where employee_id = p_employee_id and valid_to is null order by valid_from desc limit 1 for update;
    if exists (select 1 from roster_rates x where x.employee_id = p_employee_id and x.valid_from >= p_from and (v_prev.id is null or x.id <> v_prev.id)) then
      raise exception 'Ya hay una tarifa de esa persona que empieza en esa fecha o después: cargá una fecha posterior';
    end if;
  else
    perform pg_advisory_xact_lock(hashtext('roster_rates:' || lower(v_cat)));
    select * into v_prev from roster_rates where lower(job_category) = lower(v_cat) and valid_to is null order by valid_from desc limit 1 for update;
    if exists (select 1 from roster_rates x where lower(x.job_category) = lower(v_cat) and x.valid_from >= p_from and (v_prev.id is null or x.id <> v_prev.id)) then
      raise exception 'Ya hay una tarifa de esa categoría que empieza en esa fecha o después: cargá una fecha posterior';
    end if;
  end if;

  -- Una tarifa nueva cambia el costo de todos los días desde su fecha: no puede alcanzar un período ya cerrado.
  if exists (select 1 from roster_closures c where c.reopened_at is null and c.date_to >= p_from) then
    raise exception 'La tarifa empezaría dentro de un período cerrado: reabrilo o cargala desde una fecha posterior';
  end if;
  if v_prev.id is not null then
    if p_from <= v_prev.valid_from then raise exception 'La fecha tiene que ser posterior al inicio de la tarifa vigente (%)', to_char(v_prev.valid_from, 'DD/MM/YYYY'); end if;
    update roster_rates set valid_to = p_from - 1 where id = v_prev.id;
  end if;

  insert into roster_rates (employee_id, job_category, hourly_rate, currency, valid_from, note, created_by)
  values (p_employee_id, v_cat, round(p_rate, 2), p_currency, p_from, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning * into v_row;
  perform roster_log('tarifa', v_row.id, 'alta', case when v_prev.id is null then null else to_jsonb(v_prev) end, to_jsonb(v_row));
  return v_row;
end;
$function$;

-- Quita la ÚLTIMA tarifa de un destinatario (cargada por error) y reabre la anterior. No toca períodos cerrados.
create or replace function public.roster_delete_rate(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old roster_rates;
  v_prev roster_rates;
begin
  perform roster_require_rates();
  select * into v_old from roster_rates where id = p_id for update;
  if v_old.id is null then raise exception 'Tarifa no encontrada'; end if;
  if v_old.valid_to is not null then raise exception 'Solo se puede quitar la última tarifa (la que está vigente)'; end if;
  if exists (select 1 from roster_closures c where c.reopened_at is null and c.date_to >= v_old.valid_from) then
    raise exception 'La tarifa rige en un período cerrado: reabrilo para quitarla';
  end if;

  if v_old.employee_id is not null then
    select * into v_prev from roster_rates where employee_id = v_old.employee_id and id <> p_id order by valid_from desc limit 1 for update;
  else
    select * into v_prev from roster_rates where lower(job_category) = lower(v_old.job_category) and id <> p_id order by valid_from desc limit 1 for update;
  end if;
  delete from roster_rates where id = p_id;
  if v_prev.id is not null and v_prev.valid_to = v_old.valid_from - 1 then
    update roster_rates set valid_to = null where id = v_prev.id;
  end if;
  perform roster_log('tarifa', p_id, 'baja', to_jsonb(v_old), null);
end;
$function$;

-- Costo por persona sobre los días CONFIRMADOS del período (máx. 62 días).
-- Costo del día = precio × (normales + extra50 × (1 + recargo hábil) + extra100 × (1 + recargo feriado) + viaje).
-- No incluye adicionales (nocturnidad, viáticos): son parámetros del convenio que se definen aparte.
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
    select a.employee_id, a.day, a.hours_normal, a.hours_extra50, a.hours_extra100, a.hours_travel, e.job_category
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
        and (r.employee_id = s.employee_id or (r.employee_id is null and lower(r.job_category) = lower(s.job_category)))
      order by (r.employee_id is not null) desc, r.valid_from desc
      limit 1
    ) rt on true
  )
  select pr.employee_id,
         (array_agg(pr.hourly_rate order by pr.day desc) filter (where pr.hourly_rate is not null))[1],
         (array_agg(pr.cur order by pr.day desc) filter (where pr.cur is not null))[1],
         coalesce(sum(pr.hourly_rate * (pr.hours_normal + pr.hours_extra50 * (1 + p.weekday_extra_pct / 100.0)
                                         + pr.hours_extra100 * (1 + p.holiday_extra_pct / 100.0) + pr.hours_travel)), 0),
         (count(*) filter (where pr.hourly_rate is null))::integer
  from priced pr
  group by pr.employee_id
  order by pr.employee_id;
end;
$function$;

revoke execute on function public.roster_job_categories() from public, anon;
revoke execute on function public.roster_rates_list() from public, anon;
revoke execute on function public.roster_save_rate(uuid, text, numeric, text, date, text) from public, anon;
revoke execute on function public.roster_delete_rate(uuid) from public, anon;
revoke execute on function public.roster_cost_summary(date, date, uuid) from public, anon;

grant execute on function public.roster_job_categories() to authenticated;
grant execute on function public.roster_rates_list() to authenticated;
grant execute on function public.roster_save_rate(uuid, text, numeric, text, date, text) to authenticated;
grant execute on function public.roster_delete_rate(uuid) to authenticated;
grant execute on function public.roster_cost_summary(date, date, uuid) to authenticated;
