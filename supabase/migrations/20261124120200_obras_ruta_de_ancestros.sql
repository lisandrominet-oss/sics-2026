-- Ruta de cada ítem de obra (sus ancestros y él mismo), para filtrar "este ítem y todo lo que cuelga de él"
-- con una sola condición: project_nodes.path @> array[id]. Los ítems no cambian de padre, así que alcanza
-- con calcularla al insertar.
alter table public.project_nodes add column if not exists path uuid[] not null default '{}';

create or replace function public.project_nodes_set_path()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.parent_id is null then
    new.path := array[new.id];
  else
    select p.path || new.id into new.path from project_nodes p where p.id = new.parent_id;
    if new.path is null then raise exception 'Ítem padre inexistente'; end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.project_nodes_set_path() from public, anon;

drop trigger if exists project_nodes_set_path on public.project_nodes;
create trigger project_nodes_set_path
  before insert on public.project_nodes
  for each row execute function public.project_nodes_set_path();

-- Por si ya hubiera ítems cargados.
with recursive t as (
  select id, array[id] as path from public.project_nodes where parent_id is null
  union all
  select n.id, t.path || n.id from public.project_nodes n join t on n.parent_id = t.id
)
update public.project_nodes n set path = t.path from t where t.id = n.id and n.path is distinct from t.path;

create index if not exists project_nodes_path_gin on public.project_nodes using gin (path);
