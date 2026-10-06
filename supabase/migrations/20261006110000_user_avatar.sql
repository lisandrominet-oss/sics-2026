-- Foto de perfil: columna en profiles, bucket privado "avatars" (cada usuario solo ve y maneja su carpeta)
-- y RPC para guardar la ruta de la propia foto.

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_my_avatar(p_path text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_path is not null and (p_path not like v_uid::text || '/%' or length(p_path) > 300) then
    raise exception 'Ruta de foto inválida';
  end if;
  update profiles set avatar_path = p_path where id = v_uid;
end;
$$;

revoke all on function public.set_my_avatar(text) from public;
revoke all on function public.set_my_avatar(text) from anon;
grant execute on function public.set_my_avatar(text) to authenticated;
