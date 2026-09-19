create sequence if not exists public.order_number_seq;

alter table public.orders
  add column if not exists order_number text;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'CMD-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

update public.orders
set order_number = public.generate_order_number()
where order_number is null;

alter table public.orders
  alter column order_number set default public.generate_order_number();

alter table public.orders
  alter column order_number set not null;

create unique index if not exists orders_order_number_key
  on public.orders(order_number);
