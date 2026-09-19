-- Invoice status and server-side Telegram alert queue integration.

do $$
begin
  if exists (
    select 1 from public.invoices
    group by order_id
    having count(*) > 1
  ) then
    raise exception 'Migration stopped: duplicate public.invoices.order_id values exist';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_index idx
    join pg_class tbl on tbl.oid = idx.indrelid
    join pg_namespace nsp on nsp.oid = tbl.relnamespace
    where nsp.nspname = 'public'
      and tbl.relname = 'invoices'
      and idx.indisunique
      and idx.indisvalid
      and pg_get_indexdef(idx.indexrelid) ilike '%(order_id)%'
  ) then
    raise exception 'Migration stopped: invoices(order_id) has no valid unique index or constraint';
  end if;
end;
$$;

alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists status text;
alter table public.telegram_alert_queue add column if not exists alert_key text;
alter table public.telegram_alert_queue add column if not exists claimed_at timestamptz;

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status is null or status in ('draft', 'cancelled'));

create index if not exists invoices_due_date_idx
  on public.invoices(due_date) where due_date is not null;

create unique index if not exists telegram_alert_queue_alert_key_uidx
  on public.telegram_alert_queue(alert_key);

alter table public.telegram_alert_queue enable row level security;

drop view if exists public.invoice_status_summary;
create view public.invoice_status_summary with (security_invoker = true) as
with payment_totals as (
  select p.order_id,
    coalesce(sum(round(p.amount * 100)::bigint), 0)::bigint as paid_cents
  from public.payments p
  group by p.order_id
)
select i.id, i.order_id, i.amount as total_ttc,
  round(i.amount * 100)::bigint as total_cents,
  i.due_date, i.status as explicit_status,
  coalesce(pt.paid_cents, 0)::bigint as paid_cents,
  case
    when i.status = 'draft' then 'draft'
    when i.status = 'cancelled' then 'cancelled'
    when coalesce(pt.paid_cents, 0) >= round(i.amount * 100)::bigint then 'paid'
    when coalesce(pt.paid_cents, 0) > 0 then 'partial'
    when i.due_date is not null
      and i.due_date < (now() at time zone 'Africa/Casablanca')::date then 'overdue'
    else 'unpaid'
  end as derived_status,
  (
    i.status is null
    and coalesce(pt.paid_cents, 0) < round(i.amount * 100)::bigint
    and i.due_date is not null
    and i.due_date < (now() at time zone 'Africa/Casablanca')::date
  ) as is_overdue,
  i.created_at
from public.invoices i
left join payment_totals pt on pt.order_id = i.order_id;

revoke all on public.invoice_status_summary from anon;
grant select on public.invoice_status_summary to authenticated, service_role;

create or replace function public.queue_invoice_payment_alert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_invoice_number text;
  v_order_number text;
  v_total_ttc numeric(10, 2);
  v_alert_key text;
  v_event_type text;
begin
  begin
    if tg_table_name = 'invoices' then
      v_invoice_id := new.id;
      v_total_ttc := new.amount;
      v_event_type := 'invoice.created';
      v_alert_key := 'invoice.created:' || new.id::text;
      v_invoice_number := 'FAC-' || upper(left(replace(new.id::text, '-', ''), 6));
      select o.order_number into v_order_number
      from public.orders o where o.id = new.order_id;
    elsif tg_table_name = 'payments' then
      v_event_type := 'payment.created';
      v_alert_key := 'payment.created:' || new.id::text;
      select i.id, i.amount,
        'FAC-' || upper(left(replace(i.id::text, '-', ''), 6)),
        o.order_number
      into v_invoice_id, v_total_ttc, v_invoice_number, v_order_number
      from public.invoices i
      join public.orders o on o.id = i.order_id
      where i.order_id = new.order_id
      limit 1;
      if v_invoice_id is null then return new; end if;
    else
      return new;
    end if;

    insert into public.telegram_alert_queue(alert_key, event_type, payload)
    values (
      v_alert_key,
      v_event_type,
      jsonb_build_object(
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'order_number', v_order_number,
        'amount_ttc', v_total_ttc,
        'payment_amount', case when tg_table_name = 'payments' then new.amount else null end
      )
    )
    on conflict (alert_key) do nothing;
  exception when others then
    raise warning 'Telegram queue insert failed for %.%: %', tg_table_name, tg_op, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.queue_invoice_payment_alert() from public, anon, authenticated;

create or replace function public.claim_telegram_alerts(
  p_id bigint default null,
  p_limit integer default 20
)
returns setof public.telegram_alert_queue
language plpgsql security definer set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;
  return query
  with candidates as (
    select q.id
    from public.telegram_alert_queue q
    where q.alert_key is not null
      and q.sent_at is null
      and q.attempts < 3
      and q.created_at > now() - interval '24 hours'
      and (
        q.claimed_at is null
        or q.claimed_at < now() - interval '2 minutes'
      )
      and (p_id is null or q.id = p_id)
    order by q.created_at, q.id
    limit p_limit
    for update skip locked
  )
  update public.telegram_alert_queue q
  set attempts = q.attempts + 1, claimed_at = now()
  from candidates c
  where q.id = c.id
  returning q.*;
end;
$$;

revoke execute on function public.claim_telegram_alerts(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.claim_telegram_alerts(bigint, integer) to service_role;

create or replace function public.mark_telegram_alert_sent(p_id bigint)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_updated integer;
begin
  update public.telegram_alert_queue
  set sent_at = now(), last_error = null, claimed_at = null
  where id = p_id and alert_key is not null and sent_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke execute on function public.mark_telegram_alert_sent(bigint)
  from public, anon, authenticated;
grant execute on function public.mark_telegram_alert_sent(bigint) to service_role;

create or replace function public.mark_telegram_alert_failed(p_id bigint, p_error text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_updated integer;
begin
  update public.telegram_alert_queue
  set last_error = left(coalesce(p_error, 'Unknown Telegram error'), 2000),
      claimed_at = null
  where id = p_id and alert_key is not null and sent_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke execute on function public.mark_telegram_alert_failed(bigint, text)
  from public, anon, authenticated;
grant execute on function public.mark_telegram_alert_failed(bigint, text) to service_role;

drop trigger if exists telegram_payments_alert on public.payments;
drop trigger if exists telegram_payment_created_alert on public.payments;
drop trigger if exists telegram_invoices_alert on public.invoices;
drop trigger if exists telegram_invoice_created_alert on public.invoices;

create trigger telegram_invoice_created_alert
after insert on public.invoices
for each row execute function public.queue_invoice_payment_alert();

create trigger telegram_payment_created_alert
after insert on public.payments
for each row execute function public.queue_invoice_payment_alert();
