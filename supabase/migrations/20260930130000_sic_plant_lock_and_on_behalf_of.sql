-- El área/planta de una SIC se identifica automáticamente por el perfil de quien la crea.
-- Solo Compras/Admin pueden elegir una planta distinta (caso excepcional: un área sin
-- acceso a su mail corporativo), y en ese caso pueden dejar asentado en nombre de quién
-- se está pidiendo (texto libre, no requiere que esa persona ya tenga un perfil creado).

alter table sics add column if not exists on_behalf_of text;

create or replace function public.create_sic(
  p_subject text,
  p_project_id uuid,
  p_needed_by_date date,
  p_currency currency_code default 'ARS'::currency_code,
  p_plant_id uuid default null::uuid,
  p_items jsonb default '[]'::jsonb,
  p_on_behalf_of text default null
)
returns sics
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_profile profiles;
  v_role user_role;
  v_plant_id uuid;
  v_on_behalf_of text;
  v_year int := extract(year from now())::int;
  v_seq int;
  v_prefix text;
  v_code text;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or not v_profile.active then
    raise exception 'Usuario no habilitado';
  end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('area','gerencia','compras','admin') then
    raise exception 'Rol sin permiso para crear SIC';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Debe indicar entre 1 y 50 artículos';
  end if;

  -- Solo compras/admin pueden emitir una SIC en nombre de otra área o persona.
  if v_role in ('compras', 'admin') then
    v_plant_id := coalesce(p_plant_id, v_profile.plant_id);
    v_on_behalf_of := nullif(trim(p_on_behalf_of), '');
  else
    v_plant_id := v_profile.plant_id;
    v_on_behalf_of := null;
  end if;

  if v_plant_id is null then
    raise exception 'Debe indicar la planta de la SIC';
  end if;

  select prefix into v_prefix from plants where id = v_plant_id and active;
  if v_prefix is null then
    raise exception 'Planta inválida o inactiva';
  end if;

  insert into sic_counters (plant_id, year, last_seq) values (v_plant_id, v_year, 1)
  on conflict (plant_id, year) do update set last_seq = sic_counters.last_seq + 1
  returning last_seq into v_seq;

  v_code := 'SIC-' || v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into sics (code, plant_id, year, sequence, requester_id, department, subject, project_id, needed_by_date, currency, status, on_behalf_of)
  values (v_code, v_plant_id, v_year, v_seq, v_profile.id, v_profile.department, p_subject, p_project_id, p_needed_by_date, p_currency, 'enviada', v_on_behalf_of)
  returning * into v_sic;

  insert into sic_items (sic_id, position, description, quantity, specs, reference_link, requires_quality_cert)
  select v_sic.id, ord::int, item->>'description', (item->>'quantity')::numeric, nullif(item->>'specs',''), nullif(item->>'reference_link',''), coalesce((item->>'requires_quality_cert')::boolean, false)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord);

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (v_sic.id, v_profile.id, null, 'enviada', 'SIC creada');

  return v_sic;
end;
$function$;

revoke execute on function public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text) from public;
revoke execute on function public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text) from anon;
grant execute on function public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text) to authenticated;

-- CREATE OR REPLACE con un parámetro nuevo al final crea un segundo overload en vez de
-- reemplazar el original; hay que borrar la firma vieja de 6 argumentos a mano o queda
-- un camino sin la restricción de rol nueva.
drop function if exists public.create_sic(text, uuid, date, currency_code, uuid, jsonb);
