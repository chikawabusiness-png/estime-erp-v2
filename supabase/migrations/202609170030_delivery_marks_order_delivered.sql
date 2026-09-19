create or replace function public.sync_order_status_from_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_status text;
begin
  if new.status <> 'delivered'
    or old.status is not distinct from new.status then
    return new;
  end if;

  select status
    into v_order_status
  from public.orders
  where id = new.order_id
  for update;

  if not found or v_order_status in ('livré', 'annulé', 'retourné') then
    return new;
  end if;

  -- Stock was already reduced when the order was confirmed.
  -- Delivery completion only closes the order; it never changes stock.
  update public.orders
  set status = 'livré',
      updated_at = now()
  where id = new.order_id;

  return new;
end;
$$;

drop trigger if exists sync_order_status_after_delivery on public.deliveries;
create trigger sync_order_status_after_delivery
after update of status on public.deliveries
for each row execute function public.sync_order_status_from_delivery();

grant execute on function public.sync_order_status_from_delivery()
to anon, authenticated;

notify pgrst, 'reload schema';
