begin;

do $$
declare
  v_customer uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
  v_count integer;
  v_payload jsonb;
begin
  insert into public.customers (id, full_name) values (v_customer, 'Alert Test');
  insert into public.orders (id, customer_id, status) values (v_order, v_customer, 'draft');
  insert into public.invoices (id, order_id, amount) values (v_invoice, v_order, 150.00);
  select count(*), max(payload) into v_count, v_payload
  from public.telegram_alert_queue
  where alert_key = 'invoice.created:' || v_invoice::text;
  assert v_count = 1, 'invoice must create one queue row';
  assert v_payload->>'invoice_id' = v_invoice::text, 'invoice_id missing';
  assert v_payload->>'invoice_number' = 'FAC-' || upper(left(replace(v_invoice::text, '-', ''), 6)), 'invoice number mismatch';
  insert into public.payments (id, order_id, method, amount)
  values (v_payment, v_order, 'cash', 150.00);
  select count(*), max(payload) into v_count, v_payload
  from public.telegram_alert_queue
  where alert_key = 'payment.created:' || v_payment::text;
  assert v_count = 1, 'payment must create one queue row';
  assert v_payload->>'invoice_id' = v_invoice::text, 'payment invoice_id missing';
  assert v_payload->>'payment_amount' = '150.00', 'payment amount missing';
end;
$$;

do $$
declare
  v_customer uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_invoice uuid := gen_random_uuid();
  v_payment uuid := gen_random_uuid();
begin
  create or replace function pg_temp.fail_queue_insert()
  returns trigger language plpgsql as $f$
  begin raise exception 'intentional queue failure'; end
  $f$;
  create temporary trigger fail_queue_insert
  before insert on public.telegram_alert_queue
  for each row when (new.alert_key is not null)
  execute function pg_temp.fail_queue_insert();
  insert into public.customers (id, full_name) values (v_customer, 'Failure Test');
  insert into public.orders (id, customer_id, status) values (v_order, v_customer, 'draft');
  insert into public.invoices (id, order_id, amount) values (v_invoice, v_order, 10.00);
  assert exists (select 1 from public.invoices where id = v_invoice), 'invoice was rolled back';
  insert into public.payments (id, order_id, method, amount)
  values (v_payment, v_order, 'cash', 10.00);
  assert exists (select 1 from public.payments where id = v_payment), 'payment was rolled back';
end;
$$;

do $$
declare v_key text := 'test:duplicate:' || gen_random_uuid(); v_count integer;
begin
  insert into public.telegram_alert_queue(alert_key, event_type, payload)
  values (v_key, 'invoice.created', '{}'::jsonb);
  insert into public.telegram_alert_queue(alert_key, event_type, payload)
  values (v_key, 'invoice.created', '{}'::jsonb)
  on conflict (alert_key) do nothing;
  select count(*) into v_count from public.telegram_alert_queue where alert_key = v_key;
  assert v_count = 1, 'duplicate key was not deduplicated';
end;
$$;

do $$
declare v_count integer; v_key text := 'test:claim:' || gen_random_uuid(); v_id bigint;
begin
  insert into public.telegram_alert_queue(event_type, payload)
  values ('legacy.ignored', '{}'::jsonb);
  assert not exists (
    select 1 from public.claim_telegram_alerts(null, 100) where alert_key is null
  ), 'legacy row was claimed';
  insert into public.telegram_alert_queue(alert_key, event_type, payload)
  values (v_key, 'invoice.created', '{}'::jsonb)
  returning id into v_id;
  select count(*) into v_count from public.claim_telegram_alerts(v_id, 1);
  assert v_count = 1, 'first claim failed';
  select count(*) into v_count from public.claim_telegram_alerts(v_id, 1);
  assert v_count = 0, 'second claim inside lease succeeded';
  update public.telegram_alert_queue set claimed_at = now() - interval '3 minutes' where id = v_id;
  for i in 1..2 loop
    select count(*) into v_count from public.claim_telegram_alerts(v_id, 1);
    assert v_count = 1, 'retry claim failed';
    update public.telegram_alert_queue set claimed_at = now() - interval '3 minutes' where id = v_id;
  end loop;
  select count(*) into v_count from public.claim_telegram_alerts(v_id, 1);
  assert v_count = 0, 'fourth claim succeeded';
  assert (select attempts from public.telegram_alert_queue where id = v_id) = 3, 'attempts exceeded 3';
end;
$$;

rollback;
