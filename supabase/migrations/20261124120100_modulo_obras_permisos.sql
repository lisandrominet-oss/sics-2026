-- Las funciones nuevas o recreadas del módulo Obras quedaban ejecutables por PUBLIC y anon (privilegio por defecto
-- de Postgres). Todas exigen sesión, pero se dejan igual que el resto: solo authenticated (y service_role).
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.can_manage_obras()',
    'public.can_view_obras()',
    'public.obras_access()',
    'public.sics_project_node_guard()',
    'public.check_sic_project_node(uuid, uuid)',
    'public.create_sic(text, uuid, date, currency_code, uuid, jsonb, text, uuid)',
    'public.update_sic_details(uuid, text, uuid, date, jsonb, uuid, boolean)',
    'public.sic_node_label(uuid)',
    'public.set_sic_project_node(uuid, uuid)',
    'public.obra_import(uuid, jsonb, jsonb)',
    'public.obra_plan_delete(uuid)',
    'public.obra_project_update(uuid, text, text)',
    'public.obra_node_create(uuid, uuid, text, text, text, date, date)',
    'public.obra_node_rename(uuid, text, text)',
    'public.obra_node_set_active(uuid, boolean, text)',
    'public.obra_node_reschedule(uuid, date, date, text)',
    'public.obra_node_shift(uuid, int, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;
