-- Identificación específica de máquinas/camionetas alquiladas (chasis, dominio, motor),
-- y un número interno de SerInd por equipo que se puede cargar/corregir en cualquier
-- momento (incluso con el contrato ya devuelto), independiente del resto del contrato.

alter table contract_items
  add column if not exists chassis_number text,
  add column if not exists domain text,
  add column if not exists engine_number text,
  add column if not exists internal_number text;

create or replace function public.create_contract(
  p_provider_id uuid,
  p_plant_id uuid,
  p_project_id uuid,
  p_sic_id uuid,
  p_start_date date,
  p_end_date date,
  p_renewal_type contract_renewal_type,
  p_renewal_months integer,
  p_notice_days integer,
  p_notes text,
  p_items jsonb default '[]'::jsonb
)
returns contracts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_contract contracts;
  v_item jsonb;
  v_item_id uuid;
  k integer;
  v_period_start date;
  v_period_end date;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso para crear contratos';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'La fecha de vencimiento debe ser posterior al inicio';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'El contrato necesita al menos un ítem';
  end if;

  insert into contracts (provider_id, plant_id, project_id, sic_id, owner_id, start_date, end_date, renewal_type, renewal_months, notice_days, notes, created_by)
  values (p_provider_id, p_plant_id, p_project_id, p_sic_id, auth.uid(), p_start_date, p_end_date, p_renewal_type, p_renewal_months, coalesce(p_notice_days, 0), p_notes, auth.uid())
  returning * into v_contract;

  for v_item in select jsonb_array_elements(p_items) loop
    insert into contract_items (contract_id, type, description, identifier, chassis_number, domain, engine_number)
    values (
      v_contract.id,
      (v_item->>'type')::contract_item_type,
      v_item->>'description',
      nullif(v_item->>'identifier', ''),
      nullif(v_item->>'chassis_number', ''),
      nullif(v_item->>'domain', ''),
      nullif(v_item->>'engine_number', '')
    )
    returning id into v_item_id;

    insert into contract_item_rates (item_id, valid_from, monthly_rate_usd, included_hours, overage_rate_usd, excess_rule, created_by)
    values (
      v_item_id,
      p_start_date,
      (v_item->>'monthly_rate_usd')::numeric,
      nullif(v_item->>'included_hours', '')::numeric,
      nullif(v_item->>'overage_rate_usd', '')::numeric,
      coalesce(nullif(v_item->>'excess_rule', ''), 'franquicia_hora'),
      auth.uid()
    );
  end loop;

  k := 0;
  loop
    v_period_start := (p_start_date + (k || ' months')::interval)::date;
    exit when v_period_start > p_end_date;
    v_period_end := least(((p_start_date + ((k + 1) || ' months')::interval - interval '1 day'))::date, p_end_date);
    insert into contract_installments (contract_id, period_start, period_end)
    values (v_contract.id, v_period_start, v_period_end);
    k := k + 1;
    exit when k > 1200;
  end loop;

  return v_contract;
end;
$function$;

revoke execute on function public.create_contract(uuid, uuid, uuid, uuid, date, date, contract_renewal_type, integer, integer, text, jsonb) from public;
revoke execute on function public.create_contract(uuid, uuid, uuid, uuid, date, date, contract_renewal_type, integer, integer, text, jsonb) from anon;
grant execute on function public.create_contract(uuid, uuid, uuid, uuid, date, date, contract_renewal_type, integer, integer, text, jsonb) to authenticated;

-- Número interno de SerInd por equipo: compras/admin, sin restricción de estado del
-- contrato (se puede cargar o corregir en cualquier momento).
create or replace function public.set_contract_item_internal_number(
  p_item_id uuid,
  p_internal_number text
)
returns contract_items
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_item contract_items;
  v_old text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select * into v_item from contract_items where id = p_item_id;
  if v_item is null then raise exception 'Equipo no encontrado'; end if;
  v_old := v_item.internal_number;

  update contract_items set internal_number = nullif(trim(p_internal_number), '') where id = p_item_id;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (
    v_item.contract_id,
    auth.uid(),
    'numero_interno',
    jsonb_build_object('internal_number', v_old),
    jsonb_build_object('internal_number', nullif(trim(p_internal_number), '')),
    null
  );

  select * into v_item from contract_items where id = p_item_id;
  return v_item;
end;
$function$;

revoke execute on function public.set_contract_item_internal_number(uuid, text) from public;
revoke execute on function public.set_contract_item_internal_number(uuid, text) from anon;
grant execute on function public.set_contract_item_internal_number(uuid, text) to authenticated;
