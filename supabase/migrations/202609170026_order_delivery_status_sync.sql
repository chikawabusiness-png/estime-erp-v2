create or replace function public.sync_delivery_status_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('annulé', 'retourné') then
    update public.deliveries
    set status = 'cancelled',
        updated_at = now()
    where order_id = new.id
      and status <> 'delivered';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_delivery_status_after_order on public.orders;
create trigger sync_delivery_status_after_order
after update of status on public.orders
for each row execute function public.sync_delivery_status_from_order();

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

  select status into v_order_status
  from public.orders
  where id = new.order_id
  for update;

  if not found or v_order_status in ('livré', 'annulé', 'retourné') then
    return new;
  end if;

  update public.orders
  set status = case when new.status = 'delivered' then 'livré' else 'annulé' end,
      updated_at = now()
  where id = new.order_id;

  return new;
end;
$$;
