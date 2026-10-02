-- Compras con cuenta corriente (etapa 1).
-- Compras decide al revisar una SIC si es compra normal o de cuenta corriente. En cuenta corriente
-- se saltean cotización, validación técnica y Gerencia: la SIC pasa a "aprobada" y sigue con
-- orden de compra → recepción (remito de Pañol) → cierre. La factura llega mensual (etapa 2).

alter table providers add column if not exists has_current_account boolean not null default false;

alter table sics
  add column if not exists purchase_type text not null default 'normal',
  add column if not exists provider_id uuid references providers(id);

alter table sics drop constraint if exists sics_purchase_type_check;
alter table sics add constraint sics_purchase_type_check check (purchase_type in ('normal', 'cuenta_corriente'));

-- Clasificar como cuenta corriente (desde "enviada" o "cotizando").
create or replace function public.classify_sic_current_account(p_sic_id uuid, p_provider_id uuid, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
  v_provider providers;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede clasificar una SIC como cuenta corriente';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status not in ('enviada', 'cotizando') then
    raise exception 'Solo se puede clasificar una SIC enviada o en cotización';
  end if;

  select * into v_provider from providers where id = p_provider_id;
  if v_provider is null then raise exception 'Proveedor no encontrado'; end if;
  if not v_provider.active then raise exception 'El proveedor está archivado'; end if;
  if not v_provider.has_current_account then
    raise exception 'El proveedor no tiene cuenta corriente habilitada';
  end if;

  update sics
  set purchase_type = 'cuenta_corriente', provider_id = p_provider_id, status = 'aprobada', updated_at = now()
  where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'aprobada',
    'Clasificada como cuenta corriente — proveedor ' || v_provider.name
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $$;

-- Volver a compra normal (solo antes de emitir la orden de compra).
create or replace function public.revert_sic_to_normal(p_sic_id uuid, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede reclasificar una SIC';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.purchase_type <> 'cuenta_corriente' or v_sic.status <> 'aprobada' then
    raise exception 'Solo se puede volver a compra normal antes de emitir la orden de compra';
  end if;

  update sics
  set purchase_type = 'normal', provider_id = null, status = 'cotizando', updated_at = now()
  where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, 'cotizando',
    'Reclasificada como compra normal'
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $$;

-- Monto de una compra de cuenta corriente: lo carga Compras al recibir el remito.
create or replace function public.set_sic_current_account_amount(p_sic_id uuid, p_amount numeric, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras', 'admin') then
    raise exception 'Solo Compras puede cargar el monto';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Monto inválido'; end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.purchase_type <> 'cuenta_corriente' then
    raise exception 'La SIC no es de cuenta corriente';
  end if;
  if v_sic.status not in ('orden_emitida', 'recibida') then
    raise exception 'El monto se carga con la orden emitida o recibida';
  end if;

  update sics set final_amount = p_amount, updated_at = now() where id = p_sic_id;

  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (
    p_sic_id, auth.uid(), v_sic.status, v_sic.status,
    'Monto cargado: ' || p_amount::text
      || case when p_note is not null and btrim(p_note) <> '' then '. ' || p_note else '' end
  );

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $$;

-- Cierre: en cuenta corriente la factura llega mensual, así que no se exige por SIC; sí el monto.
create or replace function public.close_sic(p_sic_id uuid, p_note text default null)
returns sics
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role user_role;
  v_sic sics;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  v_role := effective_role();
  if v_role is null or v_role not in ('compras','admin') then
    raise exception 'Solo Compras puede cerrar la SIC';
  end if;

  select * into v_sic from sics where id = p_sic_id for update;
  if v_sic is null then raise exception 'SIC no encontrada'; end if;
  if v_sic.status <> 'recibida' then
    raise exception 'La SIC no está en estado "recibida"';
  end if;

  if v_sic.purchase_type = 'cuenta_corriente' then
    if v_sic.final_amount is null then
      raise exception 'Cargá el monto de la compra antes de cerrar la SIC';
    end if;
  elsif not exists (select 1 from sic_files where sic_id = p_sic_id and file_type = 'factura') then
    raise exception 'Debe subir la factura antes de cerrar la SIC';
  end if;

  update sics set status = 'cerrada', updated_at = now() where id = p_sic_id;
  insert into sic_events (sic_id, actor_id, from_status, to_status, note)
  values (p_sic_id, auth.uid(), v_sic.status, 'cerrada', p_note);

  select * into v_sic from sics where id = p_sic_id;
  return v_sic;
end; $$;

revoke execute on function public.classify_sic_current_account(uuid, uuid, text) from public;
revoke execute on function public.classify_sic_current_account(uuid, uuid, text) from anon;
grant execute on function public.classify_sic_current_account(uuid, uuid, text) to authenticated;
revoke execute on function public.revert_sic_to_normal(uuid, text) from public;
revoke execute on function public.revert_sic_to_normal(uuid, text) from anon;
grant execute on function public.revert_sic_to_normal(uuid, text) to authenticated;
revoke execute on function public.set_sic_current_account_amount(uuid, numeric, text) from public;
revoke execute on function public.set_sic_current_account_amount(uuid, numeric, text) from anon;
grant execute on function public.set_sic_current_account_amount(uuid, numeric, text) to authenticated;
