create table if not exists public.customer_cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(name)) between 2 and 80)
);

alter table public.customer_cities enable row level security;

drop policy if exists "customer_cities_select_authenticated" on public.customer_cities;
create policy "customer_cities_select_authenticated"
on public.customer_cities for select
using (auth.role() = 'authenticated');

drop policy if exists "customer_cities_write_admin" on public.customer_cities;
create policy "customer_cities_write_admin"
on public.customer_cities for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.set_customer_cities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_cities_updated_at on public.customer_cities;
create trigger customer_cities_updated_at
before update on public.customer_cities
for each row execute function public.set_customer_cities_updated_at();

insert into public.customer_cities (name)
select city
from unnest(array[
  'Agadir', 'Al Hoceima', 'Beni Mellal', 'Casablanca', 'Chefchaouen',
  'Dakhla', 'El Jadida', 'Errachidia', 'Essaouira', 'Fès', 'Ifrane',
  'Kenitra', 'Khouribga', 'Laâyoune', 'Larache', 'Marrakech', 'Meknès',
  'Mohammedia', 'Nador', 'Ouarzazate', 'Oujda', 'Rabat', 'Safi', 'Salé',
  'Settat', 'Sidi Slimane', 'Tanger', 'Tan-Tan', 'Taroudant', 'Tétouan',
  'Tiznit'
]) as cities(city)
on conflict (name) do nothing;
