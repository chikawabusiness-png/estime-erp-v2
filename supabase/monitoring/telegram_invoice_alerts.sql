-- Invoices created in the last 24 hours with no corresponding queue row.
select
  i.id,
  i.order_id,
  i.amount,
  i.created_at,
  'invoice.created:' || i.id::text as expected_alert_key
from public.invoices i
where i.created_at > now() - interval '24 hours'
  and not exists (
    select 1
    from public.telegram_alert_queue q
    where q.alert_key = 'invoice.created:' || i.id::text
  )
order by i.created_at desc;

-- New queue rows that have not been sent for more than 30 minutes.
select
  q.id,
  q.alert_key,
  q.event_type,
  q.attempts,
  q.claimed_at,
  q.last_error,
  q.created_at
from public.telegram_alert_queue q
where q.alert_key is not null
  and q.sent_at is null
  and q.created_at < now() - interval '30 minutes'
order by q.created_at asc;
