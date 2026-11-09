-- Módulo "Calidad · Avance de obra" (Fase A): esquema, RLS y plantillas semilla.
-- ADITIVA: solo objetos nuevos (cal_*). No modifica tablas, funciones ni policies existentes.
-- Se enciende con has_module('calidad'); el admin lo tiene siempre. El "enganche" (module_default y
-- staff_set_user_modules) va en una migración aparte (…_calidad_enganche.sql).
-- Escritura SOLO por RPC (sin policies de insert/update/delete).
--
-- Jerarquía: Proyecto → Sector (bahía, cocina…) → Grupo (estructura lateral, correas…) → Elemento.
-- Cada grupo tiene sus etapas (copiadas de una plantilla) y cada elemento un total y, por etapa, una cantidad.

-- ---------------------------------------------------------------- quién edita (además del admin)
create table public.cal_staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null default 'supervisor' check (role in ('supervisor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- proyectos y sectores
create table public.cal_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cal_projects_code_key on public.cal_projects (lower(code));

create table public.cal_bays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cal_projects (id) on delete cascade,
  name text not null,
  position int not null default 0,
  responsible text,
  due_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cal_bays_project_idx on public.cal_bays (project_id, position);

-- ---------------------------------------------------------------- plantillas de etapas (solo molde)
create table public.cal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stages jsonb not null check (jsonb_typeof(stages) = 'array' and jsonb_array_length(stages) between 1 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cal_templates_name_key on public.cal_templates (lower(name));

-- ---------------------------------------------------------------- grupos, etapas y elementos
create table public.cal_groups (
  id uuid primary key default gen_random_uuid(),
  bay_id uuid not null references public.cal_bays (id) on delete cascade,
  name text not null,
  position int not null default 0,
  active boolean not null default true,
  -- Última carga de avance del grupo (para mostrar "actualizado hace X, por Y").
  progress_at timestamptz,
  progress_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cal_groups_bay_idx on public.cal_groups (bay_id, position);

create table public.cal_stages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.cal_groups (id) on delete cascade,
  position int not null,
  name text not null
);
create index cal_stages_group_idx on public.cal_stages (group_id, position);

create table public.cal_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.cal_groups (id) on delete cascade,
  name text not null,
  position int not null default 0,
  total int not null default 0 check (total >= 0),
  due_date date,
  -- Automática: día en que la etapa final llegó al total (se limpia si baja).
  completed_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cal_items_group_idx on public.cal_items (group_id, position);

create table public.cal_counts (
  item_id uuid not null references public.cal_items (id) on delete cascade,
  stage_id uuid not null references public.cal_stages (id) on delete cascade,
  qty int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, stage_id)
);
create index cal_counts_stage_idx on public.cal_counts (stage_id);

-- ---------------------------------------------------------------- diario de novedades
create table public.cal_notes (
  id uuid primary key default gen_random_uuid(),
  bay_id uuid not null references public.cal_bays (id) on delete cascade,
  group_id uuid references public.cal_groups (id) on delete cascade,
  note_date date not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid references public.profiles (id),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index cal_notes_bay_idx on public.cal_notes (bay_id, note_date desc, created_at desc);

-- ---------------------------------------------------------------- historial (auditoría)
create table public.cal_events (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('project', 'bay', 'group', 'item', 'template', 'note', 'staff')),
  entity_id uuid not null,
  project_id uuid references public.cal_projects (id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles (id),
  actor_name text,
  note text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index cal_events_entity_idx on public.cal_events (entity, entity_id, created_at desc);
create index cal_events_project_idx on public.cal_events (project_id, created_at desc);

-- ---------------------------------------------------------------- plantillas semilla (de las minutas)
insert into public.cal_templates (name, stages) values
  ('Estructura metálica',
   '["Armadas","Soldadas","Pendiente END","Liberadas","En pintura y limpieza","Liberadas SI","Liberadas Fluor","Remitos","En sitio"]'::jsonb),
  ('Correas',
   '["Corte","Perforado","Pintado","Liberado Fluor","Remito","En sitio"]'::jsonb),
  ('Tornapuntas',
   '["Armado","Soldado","Pintado","Liberado Fluor","Remito","En sitio"]'::jsonb),
  ('Genérica',
   '["Fabricado","Liberado","Remito","En sitio"]'::jsonb);

-- ---------------------------------------------------------------- RLS: solo lectura directa
do $$
declare
  t text;
begin
  foreach t in array array[
    'cal_staff', 'cal_projects', 'cal_bays', 'cal_templates', 'cal_groups',
    'cal_stages', 'cal_items', 'cal_counts', 'cal_notes', 'cal_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select has_module(%L)))',
      t || '_select', t, 'calidad');
  end loop;
end $$;
