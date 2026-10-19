-- Anular un contrato mal cargado: no se borra, queda en el historial como "Anulado" con quién, cuándo y por qué.
-- Puede anular quien tenga el módulo Contratos (has_module, igual que las demás RPC de contratos).
-- Bloquea si el contrato tiene facturas o pagos vigentes (hay que anular primero cada comprobante).
-- Un contrato anulado queda congelado (triggers) y deja de contar en la deuda.

alter table public.contracts
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id),
  add column if not exists void_reason text;

alter table public.contract_events drop constraint if exists contract_events_event_type_check;
alter table public.contract_events add constraint contract_events_event_type_check
  check (event_type in (
    'renovacion', 'cambio_tarifa', 'aceptar_diferencia', 'anulacion',
    'edicion_fechas', 'edicion_equipo', 'numero_interno', 'edicion_comprobante',
    'anulacion_contrato'
  ));

-- ---------------------------------------------------------------- RPC
create or replace function public.void_contract(p_contract_id uuid, p_reason text)
returns contracts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contract contracts;
  v_vigentes integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not has_module('contratos', true) then
    raise exception 'Rol sin permiso';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Hace falta indicar el motivo de la anulación';
  end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contrato no encontrado'; end if;
  if v_contract.voided_at is not null then raise exception 'El contrato ya estaba anulado'; end if;

  select count(distinct i.id) into v_vigentes
  from provider_invoice_lines l
  join provider_invoices i on i.id = l.invoice_id
  where l.contract_id = p_contract_id and i.status = 'vigente';
  if v_vigentes > 0 then
    raise exception 'El contrato tiene % comprobante(s) vigente(s) (facturas o pagos). Anulá primero esos comprobantes.', v_vigentes;
  end if;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (
    p_contract_id, auth.uid(), 'anulacion_contrato',
    jsonb_build_object('returned', v_contract.returned, 'start_date', v_contract.start_date, 'end_date', v_contract.end_date),
    null, trim(p_reason)
  );

  -- Marca que esta transacción es la anulación oficial: sin esto el trigger no deja pasar a "anulado"
  -- (evita anular con un UPDATE directo, salteando el motivo, el evento y el chequeo de comprobantes).
  perform set_config('app.voiding', '1', true);
  update contracts
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason), updated_at = now()
  where id = p_contract_id;

  select * into v_contract from contracts where id = p_contract_id;
  return v_contract;
end;
$function$;

revoke execute on function public.void_contract(uuid, text) from public;
revoke execute on function public.void_contract(uuid, text) from anon;
grant execute on function public.void_contract(uuid, text) to authenticated;

-- ---------------------------------------------------------------- congelar lo anulado
-- Evita que cualquier RPC (editar, renovar, devolver, cargar factura u horas) toque un contrato anulado.
create or replace function public.guard_voided_contract()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contract_id uuid;
  v_voided timestamptz;
begin
  if tg_table_name = 'contracts' then
    v_voided := old.voided_at;
    if old.voided_at is null and new.voided_at is not null
       and coalesce(current_setting('app.voiding', true), '') <> '1' then
      raise exception 'Un contrato solo se anula con la acción "Anular contrato"';
    end if;
  else
    if tg_table_name in ('contract_item_rates', 'contract_usage') then
      v_contract_id := (select ci.contract_id from contract_items ci where ci.id = new.item_id);
    else
      v_contract_id := new.contract_id;
    end if;
    select c.voided_at into v_voided from contracts c where c.id = v_contract_id;
  end if;
  if v_voided is not null then
    raise exception 'El contrato está anulado y no se puede modificar';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_voided_contracts on public.contracts;
create trigger guard_voided_contracts before update on public.contracts
  for each row execute function public.guard_voided_contract();
drop trigger if exists guard_voided_contract_items on public.contract_items;
create trigger guard_voided_contract_items before insert or update on public.contract_items
  for each row execute function public.guard_voided_contract();
drop trigger if exists guard_voided_contract_rates on public.contract_item_rates;
create trigger guard_voided_contract_rates before insert on public.contract_item_rates
  for each row execute function public.guard_voided_contract();
drop trigger if exists guard_voided_contract_usage on public.contract_usage;
create trigger guard_voided_contract_usage before insert on public.contract_usage
  for each row execute function public.guard_voided_contract();
drop trigger if exists guard_voided_contract_installments on public.contract_installments;
create trigger guard_voided_contract_installments before insert on public.contract_installments
  for each row execute function public.guard_voided_contract();
drop trigger if exists guard_voided_contract_installments_upd on public.contract_installments;
create trigger guard_voided_contract_installments_upd before update on public.contract_installments
  for each row execute function public.guard_voided_contract();

-- Documentos: pueden ser de proveedor (sin contrato), así que solo se chequea si tienen contract_id.
create or replace function public.guard_voided_contract_documents()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_contract_id uuid;
begin
  v_contract_id := case when tg_op = 'DELETE' then old.contract_id else new.contract_id end;
  if v_contract_id is not null
     and exists (select 1 from contracts c where c.id = v_contract_id and c.voided_at is not null) then
    raise exception 'El contrato está anulado y no se puede modificar';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists guard_voided_contract_documents on public.contract_documents;
create trigger guard_voided_contract_documents before insert or update or delete on public.contract_documents
  for each row execute function public.guard_voided_contract_documents();

drop trigger if exists guard_voided_invoice_lines on public.provider_invoice_lines;
create trigger guard_voided_invoice_lines before insert on public.provider_invoice_lines
  for each row execute function public.guard_voided_contract();

-- ---------------------------------------------------------------- deuda: no cuenta lo anulado
create or replace function public.get_contract_debt_usd()
returns table (contract_id uuid, remaining_usd numeric)
language sql
stable
set search_path = public, pg_temp
as $$
  with billed as (
    select l.contract_id, l.period_start, sum(l.net_amount) as amount
    from provider_invoice_lines l
    join provider_invoices i on i.id = l.invoice_id
    where i.status = 'vigente' and i.kind in ('factura', 'nota_credito')
    group by l.contract_id, l.period_start
  ),
  paid as (
    select l.contract_id, l.period_start, sum(l.net_amount) as amount
    from provider_invoice_lines l
    join provider_invoices i on i.id = l.invoice_id
    where i.status = 'vigente' and i.kind = 'pago'
    group by l.contract_id, l.period_start
  )
  select
    ci.contract_id,
    coalesce(sum(
      case
        when ci.status = 'pagada' then 0
        else get_contract_installment_expected_usd(ci.contract_id, ci.period_start)
          * (1 - least(1, greatest(0,
              case when coalesce(b.amount, 0) > 0 then coalesce(p.amount, 0) / b.amount else 0 end)))
      end
    ), 0)::numeric as remaining_usd
  from contract_installments ci
  join contracts c on c.id = ci.contract_id and c.voided_at is null
  left join billed b on b.contract_id = ci.contract_id and b.period_start = ci.period_start
  left join paid p on p.contract_id = ci.contract_id and p.period_start = ci.period_start
  group by ci.contract_id;
$$;
