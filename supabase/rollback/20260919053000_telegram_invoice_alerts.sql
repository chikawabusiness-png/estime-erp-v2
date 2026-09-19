drop trigger if exists telegram_invoice_created_alert on public.invoices;
drop trigger if exists telegram_payment_created_alert on public.payments;

drop function if exists public.queue_invoice_payment_alert();
drop function if exists public.claim_telegram_alerts(bigint, integer);
drop function if exists public.mark_telegram_alert_sent(bigint);
drop function if exists public.mark_telegram_alert_failed(bigint, text);
drop view if exists public.invoice_status_summary;

create trigger telegram_payments_alert
after insert or update on public.payments
for each row execute function public.queue_telegram_alert();

drop index if exists public.telegram_alert_queue_alert_key_uidx;
alter table public.telegram_alert_queue drop column if exists alert_key;
alter table public.telegram_alert_queue drop column if exists claimed_at;

-- Keep invoices.due_date, invoices.status, attempts, last_error and sent_at.
