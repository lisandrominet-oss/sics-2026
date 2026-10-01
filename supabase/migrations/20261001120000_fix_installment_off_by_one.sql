-- Bug: la condición de corte del generador de cuotas era "exit when
-- v_period_start > p_end_date". Cuando la duración del contrato es un número
-- exacto de meses (ej. 1/9 a 1/12 = 3 meses), el último período cae
-- exactamente en p_end_date (no es > p_end_date), así que el loop generaba
-- una cuota fantasma de 1 día de más (ej. "1/12 — 1/12"). Corregido a ">="
-- en los 3 lugares donde se genera/extiende la grilla de cuotas.

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
    exit when v_period_start >= p_end_date;
    v_period_end := least(((p_start_date + ((k + 1) || ' months')::interval - interval '1 day'))::date, p_end_date);
    insert into contract_installments (contract_id, period_start, period_end)
    values (v_contract.id, v_period_start, v_period_end);
    k := k + 1;
    exit when k > 1200;
  end loop;

  return v_contract;
end;
$function$;

create or replace function public.renew_contract(p_contract_id uuid, p_new_end_date date, p_note text default null::text)
returns contracts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_contract contracts;
  v_next_k integer;
  k integer;
  v_period_start date;
  v_period_end date;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contrato no encontrado'; end if;
  if v_contract.returned then raise exception 'El contrato ya fue devuelto'; end if;
  if p_new_end_date <= v_contract.end_date then
    raise exception 'La nueva fecha de vencimiento debe ser posterior a la actual';
  end if;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (p_contract_id, auth.uid(), 'renovacion', jsonb_build_object('end_date', v_contract.end_date), jsonb_build_object('end_date', p_new_end_date), p_note);

  select count(*) into v_next_k from contract_installments where contract_id = p_contract_id;
  k := v_next_k;
  loop
    v_period_start := (v_contract.start_date + (k || ' months')::interval)::date;
    exit when v_period_start >= p_new_end_date;
    v_period_end := least(((v_contract.start_date + ((k + 1) || ' months')::interval - interval '1 day'))::date, p_new_end_date);
    insert into contract_installments (contract_id, period_start, period_end)
    values (p_contract_id, v_period_start, v_period_end)
    on conflict (contract_id, period_start) do nothing;
    k := k + 1;
    exit when k > 1200;
  end loop;

  update contracts set end_date = p_new_end_date, updated_at = now() where id = p_contract_id;
  select * into v_contract from contracts where id = p_contract_id;
  return v_contract;
end;
$function$;

create or replace function public.update_contract(
  p_contract_id uuid,
  p_start_date date,
  p_end_date date,
  p_renewal_type contract_renewal_type,
  p_renewal_months integer,
  p_notice_days integer,
  p_notes text
)
returns contracts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_contract contracts;
  v_dates_changed boolean;
  v_has_data boolean;
  k integer;
  v_period_start date;
  v_period_end date;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contrato no encontrado'; end if;
  if v_contract.returned then
    raise exception 'Este contrato ya fue devuelto y no se puede editar';
  end if;
  if p_end_date <= p_start_date then
    raise exception 'La fecha de vencimiento debe ser posterior al inicio';
  end if;

  v_dates_changed := p_start_date is distinct from v_contract.start_date
    or p_end_date is distinct from v_contract.end_date;

  if v_dates_changed then
    select
      exists(select 1 from contract_installments where contract_id = p_contract_id and status <> 'pendiente_de_factura')
      or exists(select 1 from contract_documents where contract_id = p_contract_id)
    into v_has_data;

    if v_has_data then
      raise exception 'Este contrato ya tiene datos cargados, usá "Devolver equipo" en vez de editar las fechas';
    end if;

    delete from contract_installments where contract_id = p_contract_id;

    k := 0;
    loop
      v_period_start := (p_start_date + (k || ' months')::interval)::date;
      exit when v_period_start >= p_end_date;
      v_period_end := least(((p_start_date + ((k + 1) || ' months')::interval - interval '1 day'))::date, p_end_date);
      insert into contract_installments (contract_id, period_start, period_end)
      values (p_contract_id, v_period_start, v_period_end);
      k := k + 1;
      exit when k > 1200;
    end loop;

    insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
    values (
      p_contract_id, auth.uid(), 'edicion_fechas',
      jsonb_build_object('start_date', v_contract.start_date, 'end_date', v_contract.end_date),
      jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
      null
    );
  end if;

  update contracts set
    start_date = p_start_date,
    end_date = p_end_date,
    renewal_type = p_renewal_type,
    renewal_months = p_renewal_months,
    notice_days = coalesce(p_notice_days, 0),
    notes = p_notes,
    updated_at = now()
  where id = p_contract_id;

  select * into v_contract from contracts where id = p_contract_id;
  return v_contract;
end;
$function$;

-- Limpieza de cuotas fantasma de 1 día ya generadas por el bug, en contratos
-- que todavía no tienen nada cargado (seguro, no toca datos reales).
delete from contract_installments ci
using contracts c
where ci.contract_id = c.id
  and ci.period_start = ci.period_end
  and ci.period_start = c.end_date
  and ci.status = 'pendiente_de_factura';
