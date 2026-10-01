-- Esta vez se reprodujo y verificó el error de forma directa en la base antes de
-- aplicar el arreglo (no solo leyendo el código), para asegurar que quedara resuelto.
--
-- La rama que faltaba corregir era la de "con dólar cargado" (fx_rate no nulo) de
-- void_provider_invoice: tenía un CASE con 3 ramas, todas literales de texto sin
-- castear ('pendiente_de_factura' / 'con_diferencia' / 'facturada'). Se había asumido
-- que un CASE con TODAS las ramas literales no necesita cast porque "hereda" el tipo
-- de la columna destino — eso es falso en Postgres: un CASE se resuelve como una
-- expresión SQL independiente ANTES de llegar al contexto de asignación de la columna,
-- y cuando ninguna rama tiene tipo conocido, Postgres lo resuelve como texto plano, que
-- ya no admite el cast implícito a un enum (a diferencia de una asignación directa de
-- un único literal, que sí lo admite). Se corrige casteando cada rama explícitamente.

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
  select distinct pil.contract_id, auth.uid(), 'anulacion', to_jsonb(v_invoice), null::jsonb, p_reason
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
        set status = case when v_invoiced_ars = 0 then 'pendiente_de_factura'::contract_installment_status else status end
        where contract_id = v_period.contract_id and period_start = v_period.period_start
          and status in ('facturada', 'con_diferencia', 'pagada');
      else
        v_expected_ars := v_expected_usd * v_invoice.fx_rate;
        update contract_installments
        set status = case
          when v_invoiced_ars = 0 then 'pendiente_de_factura'::contract_installment_status
          when abs(v_invoiced_ars - v_expected_ars) > greatest(v_expected_ars * v_tolerance_pct / 100.0, 1) then 'con_diferencia'::contract_installment_status
          else 'facturada'::contract_installment_status
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
