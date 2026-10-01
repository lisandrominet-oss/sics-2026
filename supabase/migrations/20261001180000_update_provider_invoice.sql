-- Permite corregir una factura/nota de crédito/pago ya cargado (número, fecha, monto,
-- archivo) sin tener que anularlo y recargarlo de cero. Solo mientras esté "vigente"
-- (no anulado). Recalcula el estado de la cuota con la misma lógica que al cargarlo
-- por primera vez, y nunca toca una cuota que ya esté "pagada".

alter table contract_events drop constraint contract_events_event_type_check;
alter table contract_events add constraint contract_events_event_type_check
  check (event_type = any (array['renovacion', 'cambio_tarifa', 'aceptar_diferencia', 'anulacion', 'edicion_fechas', 'edicion_equipo', 'numero_interno', 'edicion_comprobante']::text[]));

create or replace function public.update_provider_invoice(
  p_invoice_id uuid,
  p_number text,
  p_issue_date date,
  p_fx_rate numeric,
  p_net_amount numeric,
  p_vat_amount numeric,
  p_total_amount numeric,
  p_storage_path text,
  p_file_name text
)
returns provider_invoices
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role user_role;
  v_invoice provider_invoices;
  v_tolerance_pct numeric;
  v_period record;
  v_expected_usd numeric;
  v_expected_ars numeric;
  v_invoiced_ars numeric;
  v_line_amount numeric;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Rol sin permiso';
  end if;

  select * into v_invoice from provider_invoices where id = p_invoice_id for update;
  if v_invoice is null then raise exception 'Comprobante no encontrado'; end if;
  if v_invoice.status = 'anulado' then
    raise exception 'Este comprobante está anulado, no se puede editar';
  end if;

  if v_invoice.kind in ('factura', 'nota_credito') then
    if p_net_amount is null or p_vat_amount is null then
      raise exception 'Factura y nota de crédito requieren neto e IVA';
    end if;
    if abs((p_net_amount + p_vat_amount) - p_total_amount) > 1 then
      raise exception 'El total no coincide con neto + IVA';
    end if;
    if p_fx_rate is not null and p_fx_rate <= 0 then
      raise exception 'El dólar de la factura debe ser mayor a cero';
    end if;
    v_line_amount := p_net_amount * (case when v_invoice.kind = 'nota_credito' then -1 else 1 end);
  else
    v_line_amount := p_total_amount;
  end if;

  insert into contract_events (contract_id, actor_id, event_type, old_value, new_value, note)
  select distinct pil.contract_id, auth.uid(), 'edicion_comprobante',
    jsonb_build_object('number', v_invoice.number, 'total_amount', v_invoice.total_amount),
    jsonb_build_object('number', p_number, 'total_amount', p_total_amount),
    null
  from provider_invoice_lines pil
  where pil.invoice_id = p_invoice_id;

  update provider_invoices
  set number = p_number,
      issue_date = p_issue_date,
      fx_rate = p_fx_rate,
      net_amount = p_net_amount,
      vat_amount = p_vat_amount,
      total_amount = p_total_amount,
      storage_path = coalesce(p_storage_path, storage_path),
      file_name = coalesce(p_file_name, file_name)
  where id = p_invoice_id;

  update provider_invoice_lines
  set net_amount = v_line_amount
  where invoice_id = p_invoice_id;

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
          when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'::contract_installment_status
          else 'facturada'::contract_installment_status
        end
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('pendiente_de_factura', 'facturada', 'con_diferencia');
      end if;
    end loop;
  end if;

  select * into v_invoice from provider_invoices where id = p_invoice_id;
  return v_invoice;
end;
$function$;

revoke execute on function public.update_provider_invoice(uuid, text, date, numeric, numeric, numeric, numeric, text, text) from public;
revoke execute on function public.update_provider_invoice(uuid, text, date, numeric, numeric, numeric, numeric, text, text) from anon;
grant execute on function public.update_provider_invoice(uuid, text, date, numeric, numeric, numeric, numeric, text, text) to authenticated;
