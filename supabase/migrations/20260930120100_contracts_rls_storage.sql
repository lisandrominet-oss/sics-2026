-- Pestaña "Contratos": RLS + storage. Solo Compras/Admin, en la base y en
-- el almacenamiento de archivos (mismo patrón que el módulo de Proveedores:
-- una sola policy "staff_all" por tabla, my_role() para que un admin
-- actuando-como otro rol igual pueda administrar Contratos en la base,
-- con la interfaz ocultando la pestaña según el rol simulado).

alter table public.contracts enable row level security;
alter table public.contract_items enable row level security;
alter table public.contract_item_rates enable row level security;
alter table public.contract_usage enable row level security;
alter table public.contract_installments enable row level security;
alter table public.provider_invoices enable row level security;
alter table public.provider_invoice_lines enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contract_events enable row level security;
alter table public.contract_alerts enable row level security;

create policy contracts_staff_all on public.contracts
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_items_staff_all on public.contract_items
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_item_rates_staff_all on public.contract_item_rates
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_usage_staff_all on public.contract_usage
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_installments_staff_all on public.contract_installments
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy provider_invoices_staff_all on public.provider_invoices
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy provider_invoice_lines_staff_all on public.provider_invoice_lines
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_documents_staff_all on public.contract_documents
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_events_staff_all on public.contract_events
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

create policy contract_alerts_staff_all on public.contract_alerts
  for all
  using (my_role() = any (array['admin', 'compras']::user_role[]))
  with check (my_role() = any (array['admin', 'compras']::user_role[]));

insert into storage.buckets (id, name, public)
values ('contract-files', 'contract-files', false)
on conflict (id) do nothing;

create policy contract_files_storage_all on storage.objects
  for all
  using (bucket_id = 'contract-files' and my_role() = any (array['admin', 'compras']::user_role[]))
  with check (bucket_id = 'contract-files' and my_role() = any (array['admin', 'compras']::user_role[]));

-- Tolerancia de diferencia por defecto (%), editable desde /admin/config
-- a futuro igual que gerencia_approval_threshold_ars.
insert into public.app_settings (key, value)
values ('contract_diff_tolerance_pct', '1')
on conflict (key) do nothing;
