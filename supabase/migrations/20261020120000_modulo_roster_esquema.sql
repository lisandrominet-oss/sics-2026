-- Módulo "Roster" (Fase 2a): planificación de rotaciones sobre la base de empleados (módulo Personal).
-- No se guarda cada día de cada persona: se guarda la ASIGNACIÓN (empleado + sitio + régimen + fecha ancla
-- del ciclo + turno) y los días se calculan en roster_state(). Solo se guardan las excepciones
-- (vacaciones, licencia, extensión de ciclo...).
-- Las tablas se leen por RLS con has_module('roster'); toda escritura va por RPC SECURITY DEFINER y no hay
-- borrado de asignaciones (se les pone fecha de fin). El módulo es habilitable por usuario (admin y gerencia
-- por defecto, como Personal). Quien tiene Roster pero no Personal no lee la tabla employees: las funciones
-- de lectura devuelven solo apellido, nombre y legajo.

-- ---------------------------------------------------------------- módulo 'roster'
create or replace function public.module_default(p_role user_role, p_module text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(case
    when p_module in ('contratos', 'proveedores', 'catalogo', 'certificados') then p_role in ('compras', 'admin')
    when p_module in ('recursos-humanos', 'logistica', 'administracion', 'personal', 'roster') then p_role in ('admin', 'gerencia')
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
  v_valid text[] := array['contratos', 'proveedores', 'catalogo', 'certificados', 'recursos-humanos', 'logistica', 'administracion', 'personal', 'roster'];
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
create table public.roster_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index roster_sites_name_key on public.roster_sites (lower(name));

-- Régimen de rotación. Largo del ciclo = trabajo + franco (+ viaje si va "aparte" del bloque de trabajo).
-- travel_inside_cycle = true: los días de viaje son el primer y el último día del bloque de trabajo.
-- travel_inside_cycle = false: se suman antes y después del bloque de trabajo.
create table public.roster_patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_days integer not null check (work_days between 1 and 60),
  rest_days integer not null check (rest_days between 0 and 60),
  travel_in_days integer not null default 0 check (travel_in_days between 0 and 3),
  travel_out_days integer not null default 0 check (travel_out_days between 0 and 3),
  travel_inside_cycle boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roster_patterns_travel_check check (not travel_inside_cycle or travel_in_days + travel_out_days < work_days)
);
create unique index roster_patterns_name_key on public.roster_patterns (lower(name));

-- Puesto de dotación de un sitio: cuántas personas tienen que estar trabajando a la vez.
create table public.roster_positions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.roster_sites(id),
  name text not null,
  shift text not null default 'cualquiera' check (shift in ('dia', 'noche', 'cualquiera')),
  required_count integer not null default 1 check (required_count between 0 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index roster_positions_key on public.roster_positions (site_id, lower(name), shift);

-- Cuadrilla: etiqueta para agrupar, asignar y ver gente de a muchos (cada asignación tiene sus propios datos).
create table public.roster_crews (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.roster_sites(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index roster_crews_key on public.roster_crews (site_id, lower(name));

-- Unidad de planificación. anchor_date = primer día de un ciclo (puede ser anterior a valid_from, para
-- mantener la continuidad del ciclo). El turno alterna entre ciclos si alternate_shift.
create table public.roster_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  site_id uuid not null references public.roster_sites(id),
  position_id uuid references public.roster_positions(id),
  crew_id uuid references public.roster_crews(id),
  pattern_id uuid not null references public.roster_patterns(id),
  anchor_date date not null,
  shift text not null default 'dia' check (shift in ('dia', 'noche')),
  alternate_shift boolean not null default false,
  valid_from date not null,
  valid_to date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_assignments_dates_check check (valid_to is null or valid_to >= valid_from)
);
create index roster_assignments_employee_idx on public.roster_assignments (employee_id, valid_from);
create index roster_assignments_site_idx on public.roster_assignments (site_id, valid_from);
create index roster_assignments_pattern_idx on public.roster_assignments (pattern_id);

-- Excepciones sobre el ciclo calculado. vacaciones/licencia/enfermedad/ausencia: no está (tienen prioridad);
-- extension: trabaja aunque el ciclo diga otra cosa (ej. se queda en sitio); franco_extra: descansa.
create table public.roster_exceptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  kind text not null check (kind in ('vacaciones', 'licencia', 'enfermedad', 'ausencia', 'extension', 'franco_extra')),
  date_from date not null,
  date_to date not null,
  note text,
  covers_employee_id uuid references public.employees(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint roster_exceptions_dates_check check (date_to >= date_from)
);
create index roster_exceptions_employee_idx on public.roster_exceptions (employee_id, date_from, date_to);

-- Reglas de descanso, parametrizables (una sola fila). Las usa roster_warnings (Fase 2b).
create table public.roster_rules (
  id boolean primary key default true check (id),
  min_rest_hours integer not null default 12 check (min_rest_hours between 0 and 72),
  max_consecutive_work_days integer not null default 14 check (max_consecutive_work_days between 1 and 60),
  max_consecutive_nights integer not null default 4 check (max_consecutive_nights between 1 and 60),
  shift_hours integer not null default 12 check (shift_hours between 4 and 16),
  day_shift_start time not null default '06:00',
  night_shift_start time not null default '18:00',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.roster_rules (id) values (true);

-- Auditoría de todo cambio del roster.
create table public.roster_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('sitio', 'regimen', 'puesto', 'cuadrilla', 'asignacion', 'excepcion', 'reglas')),
  entity_id uuid,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);
create index roster_events_entity_idx on public.roster_events (entity, entity_id, created_at desc);
create index roster_events_actor_idx on public.roster_events (actor_id);

-- ---------------------------------------------------------------- RLS: solo lectura directa
do $$
declare
  t text;
begin
  foreach t in array array[
    'roster_sites', 'roster_patterns', 'roster_positions', 'roster_crews', 'roster_assignments',
    'roster_exceptions', 'roster_rules', 'roster_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select has_module(%L)))',
      t || '_staff_select', t, 'roster');
  end loop;
end $$;

-- Con Roster se ve el nombre de quien actuó en un cambio (profiles solo la leen admin, compras, gerencia y pañol).
drop policy if exists profiles_select_roster on public.profiles;
create policy profiles_select_roster on public.profiles for select to authenticated
  using (
    (select has_module('roster'))
    and exists (select 1 from public.roster_events e where e.actor_id = profiles.id)
  );
