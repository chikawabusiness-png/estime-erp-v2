create table if not exists public.telegram_alert_queue (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.telegram_alert_queue enable row level security;

create or replace function public.queue_telegram_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_alert_queue (event_type, payload)
  values (
    tg_table_name || '.' || lower(tg_op),
    jsonb_build_object(
      'table', tg_table_name,
      'operation', lower(tg_op),
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists telegram_products_alert on public.products;
create trigger telegram_products_alert
after insert or update of stock on public.products
for each row execute function public.queue_telegram_alert();

drop trigger if exists telegram_orders_alert on public.orders;
create trigger telegram_orders_alert
after insert or update of status on public.orders
for each row execute function public.queue_telegram_alert();

drop trigger if exists telegram_payments_alert on public.payments;
create trigger telegram_payments_alert
after insert or update on public.payments
for each row execute function public.queue_telegram_alert();

drop trigger if exists telegram_deliveries_alert on public.deliveries;
create trigger telegram_deliveries_alert
after insert or update of status on public.deliveries
for each row execute function public.queue_telegram_alert();

drop trigger if exists telegram_returns_alert on public.returns;
create trigger telegram_returns_alert
after insert or update of status on public.returns
for each row execute function public.queue_telegram_alert();
