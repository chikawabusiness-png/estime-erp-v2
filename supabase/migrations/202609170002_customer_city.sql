alter table public.customers
  add column if not exists city text;

alter table public.customers
  drop constraint if exists customers_city_check;

alter table public.customers
  add constraint customers_city_check
  check (city is null or char_length(trim(city)) between 2 and 80);
