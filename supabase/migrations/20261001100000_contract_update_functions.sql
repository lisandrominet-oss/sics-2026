-- Edición de contratos y de la identificación de sus equipos, para corregir errores de
-- carga. Las fechas solo se pueden tocar si el contrato todavía no tiene nada cargado
-- (ni documentos ni cuotas con factura/pago/diferencia) y no fue devuelto; si ya tiene
-- datos reales, hay que usar "Renovar" (para extender) o "Devolver equipo" (para
-- terminarlo antes), que ya existen y ya manejan eso de forma segura. Los datos de
-- identificación de cada equipo (descripción, identificador, chasis, dominio, motor)
-- se pueden corregir siempre, no afectan cuotas ni facturación.

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
      exit when v_period_start > p_end_date;
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

revoke execute on function public.update_contract(uuid, date, date, contract_renewal_type, integer, integer, text) from public;
revoke execute on function public.update_contract(uuid, date, date, contract_renewal_type, integer, integer, text) from anon;
grant execute on function public.update_contract(uuid, date, date, contract_renewal_type, integer, integer, text) to authenticated;

create or replace function public.update_contract_item(
  p_item_id uuid,
  p_description text,
  p_identifier text,
  p_chassis_number text,
  p_domain text,
  p_engine_number text
)
returns contract_items
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_item contract_items;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select * into v_item from contract_items where id = p_item_id;
  if v_item is null then raise exception 'Equipo no encontrado'; end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'La descripción no puede quedar vacía';
  end if;

  update contract_items set
    description = p_description,
    identifier = nullif(trim(p_identifier), ''),
    chassis_number = nullif(trim(p_chassis_number), ''),
    domain = nullif(trim(p_domain), ''),
    engine_number = nullif(trim(p_engine_number), '')
  where id = p_item_id;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (
    v_item.contract_id, auth.uid(), 'edicion_equipo',
    jsonb_build_object('description', v_item.description, 'identifier', v_item.identifier, 'chassis_number', v_item.chassis_number, 'domain', v_item.domain, 'engine_number', v_item.engine_number),
    jsonb_build_object('description', p_description, 'identifier', nullif(trim(p_identifier), ''), 'chassis_number', nullif(trim(p_chassis_number), ''), 'domain', nullif(trim(p_domain), ''), 'engine_number', nullif(trim(p_engine_number), '')),
    null
  );

  select * into v_item from contract_items where id = p_item_id;
  return v_item;
end;
$function$;

revoke execute on function public.update_contract_item(uuid, text, text, text, text, text) from public;
revoke execute on function public.update_contract_item(uuid, text, text, text, text, text) from anon;
grant execute on function public.update_contract_item(uuid, text, text, text, text, text) to authenticated;
