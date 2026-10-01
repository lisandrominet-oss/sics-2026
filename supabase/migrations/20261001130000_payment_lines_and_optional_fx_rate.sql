-- 1) El dólar de la factura (fx_rate) pasa a ser opcional: muchos contratos están en
--    USD pero el proveedor factura en pesos sin una referencia de dólar a mano. Si se
--    omite, la factura se guarda igual (queda "Facturada") pero sin el chequeo
--    automático de diferencia contra el canon.
-- 2) Un "Pago" ahora también lleva líneas por equipo/período (antes solo las facturas),
--    para poder mostrar cuánto se pagó de cada cuota y detectar pagos parciales. Como
--    provider_invoice_lines pasa a tener filas de pago además de filas de factura, hay
--    que filtrar explícitamente por kind al sumar "lo facturado" (si no, un pago se
--    contaría dos veces como si fuera facturación).
-- 3) Al anular un pago, la cuota vuelve a "facturada" en vez de quedar trabada en
--    "pagada" para siempre (antes esto no se manejaba).

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
    if p_fx_rate is not null and p_fx_rate <= 0 then
      raise exception 'El dólar de la factura debe ser mayor a cero';
    end if;
  end if;
  if p_kind = 'pago' and p_paid_invoice_id is null then
    raise exception 'El pago tiene que indicar qué factura cancela';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) < 1 then
    raise exception 'Hace falta al menos una línea';
  end if;

  insert into provider_invoices (provider_id, kind, number, issue_date, fx_rate, net_amount, vat_amount, total_amount, storage_path, file_name, paid_invoice_id, created_by)
  values (p_provider_id, p_kind, p_number, p_issue_date, p_fx_rate, p_net_amount, p_vat_amount, p_total_amount, p_storage_path, p_file_name, p_paid_invoice_id, auth.uid())
  returning * into v_invoice;

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

  if p_kind in ('factura', 'nota_credito') then
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
          and pi.kind in ('factura', 'nota_credito')
      );

      if p_fx_rate is null then
        update contract_installments
        set status = 'facturada'
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('pendiente_de_factura', 'facturada', 'con_diferencia');
      else
        v_expected_ars := v_expected_usd * p_fx_rate;
        update contract_installments
        set status = case
          when v_expected_ars = 0 then status
          when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'
          else 'facturada'
        end
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('pendiente_de_factura', 'facturada', 'con_diferencia');
      end if;
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
          and pi.kind in ('factura', 'nota_credito')
      );

      if v_invoice.fx_rate is null then
        update contract_installments
        set status = case when v_invoiced_ars = 0 then 'pendiente_de_factura' else status end
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('facturada', 'con_diferencia', 'pagada');
      else
        v_expected_ars := v_expected_usd * v_invoice.fx_rate;
        update contract_installments
        set status = case
          when v_invoiced_ars = 0 then 'pendiente_de_factura'
          when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'
          else 'facturada'
        end
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('facturada', 'con_diferencia', 'pagada');
      end if;
    end loop;
  end if;

  if v_invoice.kind = 'pago' then
    update contract_installments ci
    set status = 'facturada'
    where status = 'pagada'
      and exists (
        select 1 from provider_invoice_lines pil
        where pil.invoice_id = p_invoice_id
          and pil.contract_id = ci.contract_id
          and pil.period_start = ci.period_start
      );
  end if;

  select * into v_invoice from provider_invoices where id = p_invoice_id;
  return v_invoice;
end;
$function$;
