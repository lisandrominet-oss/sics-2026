-- Módulo "Remitos y Despachos" (Fase 1): esquema, RLS y bucket.
-- ADITIVA: solo objetos nuevos (remito_*). No modifica tablas, funciones ni policies existentes.
-- Se enciende con has_module('remitos'); el admin lo tiene siempre. El "enganche" (module_default y
-- staff_set_user_modules) va en una migración aparte, recién al pasar a producción.
-- Escritura SOLO por RPC (sin policies de insert/update/delete).

-- ---------------------------------------------------------------- roles internos del módulo
create table public.remito_staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'administracion', 'logistica', 'calidad', 'obra_sitio', 'obra_calidad')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- proyectos / destinos
create table public.remito_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catálogo de ítems + liberación de Calidad
create table public.remito_items (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null,
  rubric text,
  unit text not null default 'un',
  category text not null check (category in ('permanente', 'retornable', 'consumible')),
  stock numeric(14, 2) not null default 0 check (stock >= 0),
  quality_status text not null default 'pendiente' check (quality_status in ('pendiente', 'aprobado', 'rechazado')),
  quality_by uuid references public.profiles (id),
  quality_by_name text,
  quality_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index remito_items_code_key on public.remito_items (lower(code));

-- ---------------------------------------------------------------- despachos
create sequence public.remito_internal_seq;

create table public.remito_dispatches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('permanente', 'retornable', 'mixto')),
  status text not null default 'borrador' check (status in ('borrador', 'confirmado', 'anulado')),
  internal_no text unique,
  official_no text,
  project_id uuid not null references public.remito_projects (id),
  dispatched_at timestamptz not null default now(),
  reason text,
  carrier_company text,
  driver_name text,
  driver_dni text,
  tractor_plate text,
  trailer_plate text,
  notes text,
  driver_confirmed boolean not null default false,
  signature_path text,
  is_historical boolean not null default false,
  created_by uuid references public.profiles (id),
  created_by_name text,
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles (id),
  confirmed_by_name text,
  confirmed_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancelled_by_name text,
  cancelled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz not null default now(),
  -- El número interno se asigna al confirmar: un borrador anulado nunca lo recibe ("sin asignar").
  constraint remito_dispatch_internal_no_chk check (status <> 'confirmado' or internal_no is not null)
);
create index remito_dispatches_status_idx on public.remito_dispatches (status, dispatched_at desc);
create index remito_dispatches_project_idx on public.remito_dispatches (project_id);

create table public.remito_dispatch_lines (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.remito_dispatches (id) on delete cascade,
  line_no int not null,
  item_id uuid not null references public.remito_items (id),
  qty numeric(14, 2) not null check (qty > 0),
  condition text not null check (condition in ('permanente', 'retornable', 'consumible')),
  est_return_date date,
  official_no text,
  notes text,
  returned_qty numeric(14, 2) not null default 0 check (returned_qty >= 0),
  unique (dispatch_id, line_no)
);
create index remito_dispatch_lines_item_idx on public.remito_dispatch_lines (item_id);

create table public.remito_files (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.remito_dispatches (id) on delete cascade,
  kind text not null check (kind in ('carga', 'patentes', 'remito_oficial', 'otro')),
  path text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index remito_files_dispatch_idx on public.remito_files (dispatch_id);

-- Historial (auditoría). actor_name va copiado para no depender de leer profiles.
create table public.remito_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('item', 'dispatch')),
  entity_id uuid not null,
  event_type text not null,
  actor_id uuid references public.profiles (id),
  actor_name text,
  note text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index remito_events_entity_idx on public.remito_events (entity, entity_id, created_at desc);

-- Proyecto inicial (el único que hoy usa el sistema de remitos).
insert into public.remito_projects (code, name) values ('A9JM/1407', 'Vicuña');

-- ---------------------------------------------------------------- RLS: solo lectura directa
do $$
declare
  t text;
begin
  foreach t in array array[
    'remito_staff', 'remito_projects', 'remito_items', 'remito_dispatches',
    'remito_dispatch_lines', 'remito_files', 'remito_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select has_module(%L)))',
      t || '_select', t, 'remitos');
  end loop;
end $$;

-- ---------------------------------------------------------------- rol interno del usuario actual
-- admin de SICS = admin del módulo; el resto usa remito_staff. Con "Ver como" (acting_as_role) respeta
-- el rol simulado: has_module(..., true) pasa a depender de module_default.
create or replace function public.remito_role()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_p profiles;
  v_r text;
begin
  if auth.uid() is null then return null; end if;
  if not has_module('remitos', true) then return null; end if;
  select * into v_p from profiles where id = auth.uid() and active;
  if v_p.id is null then return null; end if;
  select role into v_r from remito_staff where user_id = auth.uid() and active;
  if v_r is not null then return v_r; end if;
  if v_p.role = 'admin' then return 'admin'; end if;
  return 'administracion'; -- con el módulo habilitado y sin rol interno: solo mira
end;
$function$;
revoke all on function public.remito_role() from public, anon;
grant execute on function public.remito_role() to authenticated;

-- ---------------------------------------------------------------- bucket privado de fotos y firmas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('remito-files', 'remito-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy remito_files_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'remito-files' and (select has_module('remitos')));

create policy remito_files_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'remito-files' and (select remito_role()) in ('admin', 'logistica'));

create policy remito_files_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'remito-files' and (select remito_role()) in ('admin', 'logistica'));
