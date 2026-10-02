-- Deuda de contratos en USD por contrato: canon exacto de cada cuota (tarifa vigente + horas
-- excedentes) menos la parte ya pagada. La parte pagada de una cuota es la proporción
-- pagos / facturado (ambos en ARS, sin IVA), así no hace falta tipo de cambio.
-- Una cuota "pagada" no suma deuda. Es SECURITY INVOKER: respeta RLS (solo compras/admin ven datos).
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
  left join billed b on b.contract_id = ci.contract_id and b.period_start = ci.period_start
  left join paid p on p.contract_id = ci.contract_id and p.period_start = ci.period_start
  group by ci.contract_id;
$$;

revoke execute on function public.get_contract_debt_usd() from public;
revoke execute on function public.get_contract_debt_usd() from anon;
grant execute on function public.get_contract_debt_usd() to authenticated;
