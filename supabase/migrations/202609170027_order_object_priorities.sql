alter table public.orders
  add column if not exists priority text not null default 'normale',
  add column if not exists properties jsonb not null default '{}'::jsonb;

alter table public.orders
  drop constraint if exists orders_priority_check;

alter table public.orders
  add constraint orders_priority_check
  check (priority in ('urgente', 'haute', 'normale', 'basse'));

alter table public.orders
  drop constraint if exists orders_properties_object_check;

alter table public.orders
  add constraint orders_properties_object_check
  check (jsonb_typeof(properties) = 'object');

create index if not exists orders_priority_idx
  on public.orders(priority, created_at desc);

create index if not exists orders_properties_gin_idx
  on public.orders using gin(properties);
