-- Create the profile row inside the database when a user signs up.
-- The browser-side insert in SignUp.jsx is rejected by RLS whenever email
-- confirmation is enabled (no session yet), leaving accounts without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'vendeur')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill accounts created before this trigger existed.
insert into public.profiles (id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', ''), 'vendeur'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
