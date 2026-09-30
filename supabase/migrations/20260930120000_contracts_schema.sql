-- Pestaña "Contratos": tablas base. Ver docs/contratos-especificacion.md.
-- Primera migración versionada de este repo (antes se aplicaban directo
-- contra producción sin dejar archivo en git).

create type contract_item_type as enum ('maquina', 'camioneta', 'herramienta');
create type contract_renewal_type as enum ('automatica', 'expresa', 'sin_renovacion');
create type contract_installment_status as enum (
  'pendiente_de_factura',
  'facturada',
  'pagada',
  'con_diferencia',
  'diferencia_aceptada'
);
create type provider_invoice_kind as enum ('factura', 'nota_credito', 'pago');
create type provider_invoice_status as enum ('vigente', 'anulado');
create type contract_document_type as enum (
  'contrato',
  'adenda',
  'condiciones',
  'seguro',
  'acta_devolucion',
  'informe_horas',
  'otro'
);

-- Un contrato agrupa equipos de un mismo proveedor que comparten fechas y
-- condiciones. "vigente/por_vencer/vencido" se calculan por fecha en el
-- front; acá solo se guarda "devuelto", que es un hecho real.
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  plant_id uuid references public.plants(id),
  project_id uuid references public.projects(id),
  sic_id uuid references public.sics(id),
  owner_id uuid not null references public.profiles(id),
  start_date date not null,
  end_date date not null,
  renewal_type contract_renewal_type not null,
  renewal_months integer,
  notice_days integer not null default 0,
  returned boolean not null default false,
  returned_at date,
  return_note text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_dates_check check (end_date > start_date)
);

-- Cada equipo del contrato (máquina, camioneta, herramienta).
create table public.contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  type contract_item_type not null,
  description text not null,
  identifier text,
  created_at timestamptz not null default now()
);

-- Historial de tarifas por ítem, con vigencia. La regla de exceso queda
-- como texto libre (no enum) a propósito: nuevas reglas (por km, por
-- tramos, por día) se suman como valores nuevos sin migración.
create table public.contract_item_rates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.contract_items(id) on delete cascade,
  valid_from date not null,
  monthly_rate_usd numeric not null,
  included_hours numeric,
  overage_rate_usd numeric,
  excess_rule text not null default 'franquicia_hora',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Horas de uso por ítem y período (un registro por ítem+período).
create table public.contract_usage (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.contract_items(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  hours numeric not null,
  report_storage_path text,
  report_file_name text,
  manual_expected_usd numeric,
  manual_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (item_id, period_start)
);

-- Una cuota por contrato y período, generada automáticamente desde el
-- inicio hasta el vencimiento (y al renovar, hasta el nuevo vencimiento).
create table public.contract_installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status contract_installment_status not null default 'pendiente_de_factura',
  difference_accepted_by uuid references public.profiles(id),
  difference_accepted_note text,
  difference_accepted_amount numeric,
  difference_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contract_id, period_start)
);

-- Comprobantes del proveedor (factura/nota de crédito/pago). Pertenecen
-- al proveedor, no al contrato, porque una factura discrimina varios
-- equipos (y puede cubrir más de un contrato). Nunca se borran, solo se
-- anulan.
create table public.provider_invoices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  kind provider_invoice_kind not null,
  number text,
  issue_date date not null,
  fx_rate numeric,
  net_amount numeric,
  vat_amount numeric,
  total_amount numeric not null,
  storage_path text,
  file_name text,
  paid_invoice_id uuid references public.provider_invoices(id),
  status provider_invoice_status not null default 'vigente',
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  voided_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Cada línea de un comprobante apunta a un ítem (o al total) de un
-- contrato y período puntual.
create table public.provider_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.provider_invoices(id) on delete cascade,
  contract_id uuid not null references public.contracts(id),
  item_id uuid references public.contract_items(id),
  period_start date not null,
  net_amount numeric not null,
  created_at timestamptz not null default now()
);

-- Documentos a nivel proveedor, contrato o cuota (exactamente uno de los
-- tres), con vencimiento opcional (seguros, etc.).
create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id),
  contract_id uuid references public.contracts(id),
  installment_id uuid references public.contract_installments(id),
  doc_type contract_document_type not null,
  storage_path text not null,
  file_name text not null,
  expires_at date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint contract_documents_one_level check (
    (case when provider_id is not null then 1 else 0 end) +
    (case when contract_id is not null then 1 else 0 end) +
    (case when installment_id is not null then 1 else 0 end) = 1
  )
);

-- Historial de cambios importantes (no un log genérico): renovaciones,
-- cambios de tarifa, aceptación de diferencias y anulación de comprobantes.
create table public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('renovacion', 'cambio_tarifa', 'aceptar_diferencia', 'anulacion')),
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- Las alertas (vencimientos, documentos, diferencias) se calculan al
-- vuelo por fecha/estado; esta tabla solo guarda qué alertas fueron
-- marcadas "atendidas" por alguien de Compras.
create table public.contract_alerts (
  kind text not null check (kind in ('renovacion', 'documento', 'diferencia')),
  target_id uuid not null,
  attended_by uuid references public.profiles(id),
  attended_at timestamptz not null default now(),
  primary key (kind, target_id)
);
