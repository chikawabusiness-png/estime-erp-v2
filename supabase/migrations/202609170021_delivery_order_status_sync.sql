create or replace function public.sync_order_status_from_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
begin
  if new.status not in ('delivered', 'cancelled') then
    return new;
  end if;

  select status
  into v_order_status
  from public.orders
  where id = new.order_id
  for update;

  if not found or v_order_status in ('livré', 'annulé') then
    return new;
  end if;

  update public.orders
  set status = case
    when new.status = 'delivered' then 'livré'
    when new.status = 'cancelled' then 'annulé'
  end,
      updated_at = now()
  where id = new.order_id;

  return new;
end;
$$;

drop trigger if exists sync_order_status_after_delivery on public.deliveries;
create trigger sync_order_status_after_delivery
after insert or update of status on public.deliveries
for each row execute function public.sync_order_status_from_delivery();
