-- Remitos, Fase 2: pañolero de proyecto (recepción, stock en obra y egresos).
-- Solo toca objetos remito_* (tablas, policies y funciones propias del módulo). No toca nada de SICS.
--
-- Roles del módulo: admin, administracion (solo lectura), logistica (pañolero de taller: arma despachos y
-- confirma egresos), calidad, panol_proyecto (recibe lo enviado y emite el egreso; ligado a UN proyecto).

-- ---------------------------------------------------------------- remito_staff: nuevo rol y proyecto
do $$
declare
  c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.remito_staff'::regclass and contype = 'c' loop
    execute format('alter table public.remito_staff drop constraint %I', c);
  end loop;
end $$;

alter table public.remito_staff add column project_id uuid references public.remito_projects (id);
alter table public.remito_staff add constraint remito_staff_role_check
  check (role in ('admin', 'administracion', 'logistica', 'calidad', 'panol_proyecto'));
alter table public.remito_staff add constraint remito_staff_project_check
  check ((role = 'panol_proyecto') = (project_id is not null));

-- ---------------------------------------------------------------- historial: más entidades
do $$
declare
  c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.remito_events'::regclass and contype = 'c' loop
    execute format('alter table public.remito_events drop constraint %I', c);
  end loop;
end $$;
alter table public.remito_events add constraint remito_events_entity_check
  check (entity in ('item', 'dispatch', 'egress', 'staff'));

-- ---------------------------------------------------------------- recepción en obra
-- received_qty null = todavía sin aceptar. 0 = "no llegó".
alter table public.remito_dispatch_lines add column received_qty numeric(14, 2) check (received_qty >= 0);
alter table public.remito_dispatch_lines add column received_note text;

create table public.remito_receptions (
  dispatch_id uuid primary key references public.remito_dispatches (id) on delete cascade,
  status text not null check (status in ('aceptado', 'con_diferencias')),
  received_by uuid references public.profiles (id),
  received_by_name text,
  received_at timestamptz not null default now(),
  note text
);

-- Libro de movimientos del stock de cada proyecto: "en obra" = suma de cantidades.
-- recepcion (+recibido), egreso (-sale del proyecto), reposicion (+vuelve al anular un egreso).
create table public.remito_site_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.remito_projects (id),
  item_id uuid not null references public.remito_items (id),
  kind text not null check (kind in ('recepcion', 'egreso', 'reposicion')),
  qty numeric(14, 2) not null check (qty <> 0),
  ref_type text not null check (ref_type in ('dispatch', 'egress')),
  ref_id uuid not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index remito_site_movements_project_idx on public.remito_site_movements (project_id, item_id);

-- ---------------------------------------------------------------- egresos (lo que baja del proyecto)
create sequence public.remito_egress_seq;

create table public.remito_egresses (
  id uuid primary key default gen_random_uuid(),
  internal_no text not null unique,
  project_id uuid not null references public.remito_projects (id),
  status text not null default 'en_camino' check (status in ('en_camino', 'recibido', 'anulado')),
  reason text,
  carrier_company text,
  driver_name text,
  driver_dni text,
  tractor_plate text,
  trailer_plate text,
  notes text,
  created_by uuid references public.profiles (id),
  created_by_name text,
  created_at timestamptz not null default now(),
  received_by uuid references public.profiles (id),
  received_by_name text,
  received_at timestamptz,
  received_note text,
  cancelled_by uuid references public.profiles (id),
  cancelled_by_name text,
  cancelled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz not null default now()
);
create index remito_egresses_project_idx on public.remito_egresses (project_id, status, created_at desc);

create table public.remito_egress_lines (
  id uuid primary key default gen_random_uuid(),
  egress_id uuid not null references public.remito_egresses (id) on delete cascade,
  line_no int not null,
  item_id uuid not null references public.remito_items (id),
  qty numeric(14, 2) not null check (qty > 0),
  condition text not null check (condition in ('permanente', 'retornable', 'consumible')),
  notes text,
  received_qty numeric(14, 2) check (received_qty >= 0),
  unique (egress_id, line_no)
);
create index remito_egress_lines_item_idx on public.remito_egress_lines (item_id);

-- ---------------------------------------------------------------- alcance por proyecto
-- ¿Puede el usuario actual ver lo de este proyecto? El pañolero de proyecto, solo el suyo; el resto, todos.
-- Con "Ver como" (rol efectivo nulo) se mantiene el criterio de Fase 1: alcanza con tener el módulo.
create or replace function public.remito_can_see_project(p_project uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
begin
  if auth.uid() is null then return false; end if;
  v_role := remito_role();
  if v_role is null then return has_module('remitos'); end if;
  if v_role = 'panol_proyecto' then
    return exists (select 1 from remito_staff where user_id = auth.uid() and active and project_id = p_project);
  end if;
  return true;
end;
$function$;

-- El pañolero de proyecto solo ve despachos confirmados de su proyecto (nunca borradores ni anulados).
create or replace function public.remito_can_see_dispatch(p_project uuid, p_status text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
begin
  if auth.uid() is null then return false; end if;
  v_role := remito_role();
  if v_role = 'panol_proyecto' and p_status <> 'confirmado' then return false; end if;
  return remito_can_see_project(p_project);
end;
$function$;

revoke all on function public.remito_can_see_project(uuid) from public, anon;
revoke all on function public.remito_can_see_dispatch(uuid, text) from public, anon;
grant execute on function public.remito_can_see_project(uuid) to authenticated;
grant execute on function public.remito_can_see_dispatch(uuid, text) to authenticated;

-- ---------------------------------------------------------------- RLS: solo lectura, ahora con alcance
drop policy if exists remito_staff_select on public.remito_staff;
create policy remito_staff_select on public.remito_staff for select to authenticated
  using ((select has_module('remitos')) and (user_id = auth.uid() or coalesce((select remito_role()), 'admin') <> 'panol_proyecto'));

drop policy if exists remito_dispatches_select on public.remito_dispatches;
create policy remito_dispatches_select on public.remito_dispatches for select to authenticated
  using ((select has_module('remitos')) and (select remito_can_see_dispatch(project_id, status)));

drop policy if exists remito_dispatch_lines_select on public.remito_dispatch_lines;
create policy remito_dispatch_lines_select on public.remito_dispatch_lines for select to authenticated
  using ((select has_module('remitos')) and exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

drop policy if exists remito_files_select on public.remito_files;
create policy remito_files_select on public.remito_files for select to authenticated
  using ((select has_module('remitos')) and exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

drop policy if exists remito_events_select on public.remito_events;
create policy remito_events_select on public.remito_events for select to authenticated
  using (
    (select has_module('remitos'))
    and (entity = 'item'
         or (entity = 'dispatch' and exists (select 1 from public.remito_dispatches d where d.id = entity_id))
         or (entity = 'egress' and exists (select 1 from public.remito_egresses e where e.id = entity_id))
         or (entity = 'staff' and coalesce((select remito_role()), 'admin') in ('admin', 'administracion')))
  );

create policy remito_receptions_select on public.remito_receptions for select to authenticated
  using ((select has_module('remitos')) and exists (select 1 from public.remito_dispatches d where d.id = dispatch_id));

create policy remito_site_movements_select on public.remito_site_movements for select to authenticated
  using ((select has_module('remitos')) and (select remito_can_see_project(project_id)));

create policy remito_egresses_select on public.remito_egresses for select to authenticated
  using ((select has_module('remitos')) and (select remito_can_see_project(project_id)));

create policy remito_egress_lines_select on public.remito_egress_lines for select to authenticated
  using ((select has_module('remitos')) and exists (select 1 from public.remito_egresses e where e.id = egress_id));

alter table public.remito_receptions enable row level security;
alter table public.remito_site_movements enable row level security;
alter table public.remito_egresses enable row level security;
alter table public.remito_egress_lines enable row level security;

-- Storage: las fotos y firmas de un despacho solo las ve quien puede ver ese despacho.
drop policy if exists remito_files_storage_select on storage.objects;
create policy remito_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'remito-files'
    and (select has_module('remitos'))
    and exists (select 1 from public.remito_dispatches d where d.id::text = (storage.foldername(name))[1])
  );
