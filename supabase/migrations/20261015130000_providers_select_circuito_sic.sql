-- El circuito de SIC lee proveedores por rol (nombre del proveedor en el detalle y selector de cuenta
-- corriente / compra directa), no por módulo. Con providers_staff_all pasada a has_module('proveedores'),
-- quitarle Proveedores a alguien de Compras le vaciaría esos datos en la SIC. Esta política de lectura
-- mantiene el comportamiento de siempre para Compras y admin, sin darles escritura.
drop policy if exists providers_select_sic_circuit on public.providers;
create policy providers_select_sic_circuit on public.providers for select to authenticated
  using ((select my_role()) in ('compras', 'admin'));
