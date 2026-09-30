-- Pestaña "Contratos": funciones de negocio (SECURITY DEFINER, mismo
-- patrón que las funciones de sics: chequeo de rol vía effective_role(),
-- raise exception en español ante cualquier caso inválido).

-- Esperado en USD de un ítem+período según su tarifa vigente y el uso
-- cargado. SECURITY INVOKER a propósito (no DEFINER): es de solo lectura
-- y así la RLS de las tablas de abajo se sigue aplicando normalmente
-- tanto si la llama el front directo como si la llama otra función
-- SECURITY DEFINER (en ese caso hereda el contexto de esa función).
create or replace function public.get_contract_installment_expected_usd(p_contract_id uuid, p_period_start date)
returns numeric
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(sum(
    case
      when r.excess_rule = 'manual' then coalesce(u.manual_expected_usd, r.monthly_rate_usd)
      else r.monthly_rate_usd + greatest(0, coalesce(u.hours, 0) - coalesce(r.included_hours, 0)) * coalesce(r.overage_rate_usd, 0)
    end
  ), 0)
  from contract_items ci
  join lateral (
    select *
    from contract_item_rates
    where item_id = ci.id and valid_from <= p_period_start
    order by valid_from desc
    limit 1
  ) r on true
  left join contract_usage u on u.item_id = ci.id and u.period_start = p_period_start
  where ci.contract_id = p_contract_id;
$function$;

revoke execute on function public.get_contract_installment_expected_usd(uuid, date) from public;
revoke execute on function public.get_contract_installment_expected_usd(uuid, date) from anon;
grant execute on function public.get_contract_installment_expected_usd(uuid, date) to authenticated;

-- Nuevo contrato + sus ítems (con tarifa inicial) + cuotas generadas
-- automáticamente desde el inicio hasta el vencimiento. Cada período
-- corre desde el día de inicio del contrato (regla 4.1): se computa
-- siempre `start_date + k meses` (nunca encadenando desde el período
-- anterior), porque Postgres recorta al último día de los meses cortos
-- solo cuando corresponde y así no se pierde el día de inicio original.
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
    insert into contract_items (contract_id, type, description, identifier)
    values (v_contract.id, (v_item->>'type')::contract_item_type, v_item->>'description', nullif(v_item->>'identifier', ''))
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

-- Renovar: extiende el vencimiento, genera los períodos nuevos (a partir
-- de la cantidad de cuotas ya generadas, siempre anclado al start_date
-- original del contrato) y deja el valor anterior en contract_events. No
-- pisa los períodos pasados.
create or replace function public.renew_contract(
  p_contract_id uuid,
  p_new_end_date date,
  p_note text default null
)
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
    exit when v_period_start > p_new_end_date;
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

revoke execute on function public.renew_contract(uuid, date, text) from public;
revoke execute on function public.renew_contract(uuid, date, text) from anon;
grant execute on function public.renew_contract(uuid, date, text) to authenticated;

-- Devolver equipo y finalizar contrato: exige el acta adjunta, cancela
-- las cuotas futuras que todavía no fueron facturadas y marca `returned`.
create or replace function public.return_contract(
  p_contract_id uuid,
  p_return_date date,
  p_note text,
  p_act_storage_path text,
  p_act_file_name text
)
returns contracts
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_contract contracts;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;
  if p_act_storage_path is null or p_act_file_name is null then
    raise exception 'Hace falta adjuntar el acta de devolución';
  end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contrato no encontrado'; end if;
  if v_contract.returned then raise exception 'El contrato ya estaba devuelto'; end if;

  insert into contract_documents (contract_id, doc_type, storage_path, file_name, uploaded_by)
  values (p_contract_id, 'acta_devolucion', p_act_storage_path, p_act_file_name, auth.uid());

  delete from contract_installments
  where contract_id = p_contract_id
    and status = 'pendiente_de_factura'
    and period_start > p_return_date;

  update contracts
  set returned = true, returned_at = p_return_date, return_note = p_note, updated_at = now()
  where id = p_contract_id;

  select * into v_contract from contracts where id = p_contract_id;
  return v_contract;
end;
$function$;

revoke execute on function public.return_contract(uuid, date, text, text, text) from public;
revoke execute on function public.return_contract(uuid, date, text, text, text) from anon;
grant execute on function public.return_contract(uuid, date, text, text, text) to authenticated;

-- Registrar ajuste de tarifa: nueva fila de historial + evento con el
-- valor anterior y el nuevo. No altera cuotas pasadas porque el esperado
-- de cada período siempre busca la tarifa vigente a esa fecha.
create or replace function public.add_contract_item_rate(
  p_item_id uuid,
  p_valid_from date,
  p_monthly_rate_usd numeric,
  p_included_hours numeric,
  p_overage_rate_usd numeric,
  p_excess_rule text,
  p_note text
)
returns contract_item_rates
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_contract_id uuid;
  v_old_rate contract_item_rates;
  v_new_rate contract_item_rates;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select ci.contract_id into v_contract_id from contract_items ci where ci.id = p_item_id;
  if v_contract_id is null then raise exception 'Artículo no encontrado'; end if;

  select * into v_old_rate from contract_item_rates where item_id = p_item_id order by valid_from desc limit 1;

  insert into contract_item_rates (item_id, valid_from, monthly_rate_usd, included_hours, overage_rate_usd, excess_rule, note, created_by)
  values (p_item_id, p_valid_from, p_monthly_rate_usd, p_included_hours, p_overage_rate_usd, coalesce(nullif(p_excess_rule, ''), 'franquicia_hora'), p_note, auth.uid())
  returning * into v_new_rate;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (
    v_contract_id, auth.uid(), 'cambio_tarifa',
    case when v_old_rate.id is null then null else to_jsonb(v_old_rate) end,
    to_jsonb(v_new_rate),
    p_note
  );

  return v_new_rate;
end;
$function$;

revoke execute on function public.add_contract_item_rate(uuid, date, numeric, numeric, numeric, text, text) from public;
revoke execute on function public.add_contract_item_rate(uuid, date, numeric, numeric, numeric, text, text) from anon;
grant execute on function public.add_contract_item_rate(uuid, date, numeric, numeric, numeric, text, text) to authenticated;

-- Cargar horas del mes por ítem y período (con su informe adjunto). El
-- modo "manual" exige monto esperado y nota obligatoria.
create or replace function public.record_contract_usage(
  p_item_id uuid,
  p_period_start date,
  p_period_end date,
  p_hours numeric,
  p_report_storage_path text,
  p_report_file_name text,
  p_manual_expected_usd numeric default null,
  p_manual_note text default null
)
returns contract_usage
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_usage contract_usage;
  v_rule text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select excess_rule into v_rule
  from contract_item_rates
  where item_id = p_item_id and valid_from <= p_period_start
  order by valid_from desc
  limit 1;

  if v_rule = 'manual' and (p_manual_expected_usd is null or coalesce(trim(p_manual_note), '') = '') then
    raise exception 'El modo manual requiere el monto esperado y una nota';
  end if;

  insert into contract_usage (item_id, period_start, period_end, hours, report_storage_path, report_file_name, manual_expected_usd, manual_note, created_by)
  values (p_item_id, p_period_start, p_period_end, p_hours, p_report_storage_path, p_report_file_name, p_manual_expected_usd, p_manual_note, auth.uid())
  on conflict (item_id, period_start) do update set
    period_end = excluded.period_end,
    hours = excluded.hours,
    report_storage_path = coalesce(excluded.report_storage_path, contract_usage.report_storage_path),
    report_file_name = coalesce(excluded.report_file_name, contract_usage.report_file_name),
    manual_expected_usd = excluded.manual_expected_usd,
    manual_note = excluded.manual_note
  returning * into v_usage;

  return v_usage;
end;
$function$;

revoke execute on function public.record_contract_usage(uuid, date, date, numeric, text, text, numeric, text) from public;
revoke execute on function public.record_contract_usage(uuid, date, date, numeric, text, text, numeric, text) from anon;
grant execute on function public.record_contract_usage(uuid, date, date, numeric, text, text, numeric, text) to authenticated;

-- Cargar factura / nota de crédito / pago. Valida total = neto + IVA
-- (tolerancia $1), reparte las líneas por ítem/período y recalcula el
-- estado de cada cuota tocada comparando lo esperado (a la tarifa
-- vigente, convertido al dólar de la factura) contra lo facturado neto
-- (factura − notas de crédito vigentes), con la tolerancia de
-- app_settings.contract_diff_tolerance_pct.
create or replace function public.record_provider_invoice(
  p_provider_id uuid,
  p_kind provider_invoice_kind,
  p_number text,
  p_issue_date date,
  p_fx_rate numeric,
  p_net_amount numeric,
  p_vat_amount numeric,
  p_total_amount numeric,
  p_storage_path text,
  p_file_name text,
  p_paid_invoice_id uuid,
  p_lines jsonb default '[]'::jsonb
)
returns provider_invoices
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_invoice provider_invoices;
  v_line jsonb;
  v_tolerance_pct numeric;
  v_period record;
  v_expected_usd numeric;
  v_expected_ars numeric;
  v_invoiced_ars numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  if p_kind in ('factura', 'nota_credito') then
    if p_net_amount is null or p_vat_amount is null then
      raise exception 'Factura y nota de crédito requieren neto e IVA';
    end if;
    if abs((p_net_amount + p_vat_amount) - p_total_amount) > 1 then
      raise exception 'El total no coincide con neto + IVA';
    end if;
    if p_fx_rate is null or p_fx_rate <= 0 then
      raise exception 'Falta el dólar de la factura';
    end if;
    if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) < 1 then
      raise exception 'Hace falta al menos una línea';
    end if;
  end if;
  if p_kind = 'pago' and p_paid_invoice_id is null then
    raise exception 'El pago tiene que indicar qué factura cancela';
  end if;

  insert into provider_invoices (provider_id, kind, number, issue_date, fx_rate, net_amount, vat_amount, total_amount, storage_path, file_name, paid_invoice_id, created_by)
  values (p_provider_id, p_kind, p_number, p_issue_date, p_fx_rate, p_net_amount, p_vat_amount, p_total_amount, p_storage_path, p_file_name, p_paid_invoice_id, auth.uid())
  returning * into v_invoice;

  if p_kind in ('factura', 'nota_credito') then
    for v_line in select jsonb_array_elements(p_lines) loop
      insert into provider_invoice_lines (invoice_id, contract_id, item_id, period_start, net_amount)
      values (
        v_invoice.id,
        (v_line->>'contract_id')::uuid,
        nullif(v_line->>'item_id', '')::uuid,
        (v_line->>'period_start')::date,
        (v_line->>'net_amount')::numeric * (case when p_kind = 'nota_credito' then -1 else 1 end)
      );
    end loop;

    select coalesce((select value::text::numeric from app_settings where key = 'contract_diff_tolerance_pct'), 1) into v_tolerance_pct;

    for v_period in
      select distinct contract_id, period_start from provider_invoice_lines where invoice_id = v_invoice.id
    loop
      v_expected_usd := get_contract_installment_expected_usd(v_period.contract_id, v_period.period_start);
      v_invoiced_ars := (
        select coalesce(sum(pil.net_amount), 0)
        from provider_invoice_lines pil
        join provider_invoices pi on pi.id = pil.invoice_id
        where pil.contract_id = v_period.contract_id
          and pil.period_start = v_period.period_start
          and pi.status = 'vigente'
      );
      v_expected_ars := v_expected_usd * p_fx_rate;

      update contract_installments
      set status = case
        when v_expected_ars = 0 then status
        when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'
        else 'facturada'
      end
      where contract_id = v_period.contract_id and period_start = v_period.period_start
        and status in ('pendiente_de_factura', 'facturada', 'con_diferencia');
    end loop;
  end if;

  if p_kind = 'pago' then
    update contract_installments ci
    set status = 'pagada'
    where status in ('facturada', 'diferencia_aceptada')
      and exists (
        select 1 from provider_invoice_lines pil
        where pil.invoice_id = p_paid_invoice_id
          and pil.contract_id = ci.contract_id
          and pil.period_start = ci.period_start
      );
  end if;

  return v_invoice;
end;
$function$;

revoke execute on function public.record_provider_invoice(uuid, provider_invoice_kind, text, date, numeric, numeric, numeric, numeric, text, text, uuid, jsonb) from public;
revoke execute on function public.record_provider_invoice(uuid, provider_invoice_kind, text, date, numeric, numeric, numeric, numeric, text, text, uuid, jsonb) from anon;
grant execute on function public.record_provider_invoice(uuid, provider_invoice_kind, text, date, numeric, numeric, numeric, numeric, text, text, uuid, jsonb) to authenticated;

-- Anular comprobante: nunca se borra. Recalcula el estado de las cuotas
-- que esa factura/nota de crédito tocaba, y registra el evento por cada
-- contrato afectado (una factura puede discriminar varios contratos).
create or replace function public.void_provider_invoice(p_invoice_id uuid, p_reason text)
returns provider_invoices
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_invoice provider_invoices;
  v_period record;
  v_tolerance_pct numeric;
  v_expected_usd numeric;
  v_expected_ars numeric;
  v_invoiced_ars numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Hace falta indicar el motivo de la anulación';
  end if;

  select * into v_invoice from provider_invoices where id = p_invoice_id for update;
  if v_invoice is null then raise exception 'Comprobante no encontrado'; end if;
  if v_invoice.status = 'anulado' then raise exception 'Ya estaba anulado'; end if;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  select distinct pil.contract_id, auth.uid(), 'anulacion', to_jsonb(v_invoice), null, p_reason
  from provider_invoice_lines pil
  where pil.invoice_id = p_invoice_id;

  update provider_invoices
  set status = 'anulado', voided_by = auth.uid(), voided_at = now(), voided_reason = p_reason
  where id = p_invoice_id;

  if v_invoice.kind in ('factura', 'nota_credito') then
    select coalesce((select value::text::numeric from app_settings where key = 'contract_diff_tolerance_pct'), 1) into v_tolerance_pct;

    for v_period in
      select distinct contract_id, period_start from provider_invoice_lines where invoice_id = p_invoice_id
    loop
      v_expected_usd := get_contract_installment_expected_usd(v_period.contract_id, v_period.period_start);
      v_invoiced_ars := (
        select coalesce(sum(pil.net_amount), 0)
        from provider_invoice_lines pil
        join provider_invoices pi on pi.id = pil.invoice_id
        where pil.contract_id = v_period.contract_id
          and pil.period_start = v_period.period_start
          and pi.status = 'vigente'
      );
      v_expected_ars := v_expected_usd * coalesce(v_invoice.fx_rate, 1);

      update contract_installments
      set status = case
        when v_invoiced_ars = 0 then 'pendiente_de_factura'
        when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'
        else 'facturada'
      end
      where contract_id = v_period.contract_id and period_start = v_period.period_start
        and status in ('facturada', 'con_diferencia', 'pagada');
    end loop;
  end if;

  select * into v_invoice from provider_invoices where id = p_invoice_id;
  return v_invoice;
end;
$function$;

revoke execute on function public.void_provider_invoice(uuid, text) from public;
revoke execute on function public.void_provider_invoice(uuid, text) from anon;
grant execute on function public.void_provider_invoice(uuid, text) to authenticated;

-- Aceptar diferencia: exige motivo, solo aplica a una cuota marcada
-- "con_diferencia", registra usuario/monto/motivo/fecha.
create or replace function public.accept_installment_difference(
  p_installment_id uuid,
  p_amount numeric,
  p_note text
)
returns contract_installments
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_installment contract_installments;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Hace falta un motivo para aceptar la diferencia';
  end if;

  select * into v_installment from contract_installments where id = p_installment_id for update;
  if v_installment is null then raise exception 'Cuota no encontrada'; end if;
  if v_installment.status <> 'con_diferencia' then
    raise exception 'Solo se puede aceptar la diferencia de una cuota marcada con diferencia';
  end if;

  update contract_installments
  set status = 'diferencia_aceptada',
      difference_accepted_by = auth.uid(),
      difference_accepted_note = p_note,
      difference_accepted_amount = p_amount,
      difference_accepted_at = now()
  where id = p_installment_id;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  values (v_installment.contract_id, auth.uid(), 'aceptar_diferencia', null, jsonb_build_object('installment_id', p_installment_id, 'amount', p_amount), p_note);

  select * into v_installment from contract_installments where id = p_installment_id;
  return v_installment;
end;
$function$;

revoke execute on function public.accept_installment_difference(uuid, numeric, text) from public;
revoke execute on function public.accept_installment_difference(uuid, numeric, text) from anon;
grant execute on function public.accept_installment_difference(uuid, numeric, text) to authenticated;

-- Marcar una alerta como atendida (o desmarcarla).
create or replace function public.set_contract_alert_attended(p_kind text, p_target_id uuid, p_attended boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;
  if p_kind not in ('renovacion', 'documento', 'diferencia') then
    raise exception 'Tipo de alerta inválido';
  end if;

  if p_attended then
    insert into contract_alerts (kind, target_id, attended_by, attended_at)
    values (p_kind, p_target_id, auth.uid(), now())
    on conflict (kind, target_id) do update set attended_by = auth.uid(), attended_at = now();
  else
    delete from contract_alerts where kind = p_kind and target_id = p_target_id;
  end if;
end;
$function$;

revoke execute on function public.set_contract_alert_attended(text, uuid, boolean) from public;
revoke execute on function public.set_contract_alert_attended(text, uuid, boolean) from anon;
grant execute on function public.set_contract_alert_attended(text, uuid, boolean) to authenticated;
