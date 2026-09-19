-- Restrict delivery workflow to the four supported states.
update public.deliveries
set status = case
  when status = 'failed' then 'cancelled'
  when status = 'in_transit' then 'dispatched'
  else status
end
where status in ('failed', 'in_transit');

alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('pending', 'dispatched', 'delivered', 'cancelled'));

-- Process a return exactly once, without adding fields to the returns table.
create or replace function public.apply_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_number text;
  v_reason text;
begin
  if new.status <> 'processed' or (tg_op = 'UPDATE' and old.status = 'processed') then
    return new;
  end if;

  select order_number
    into v_order_number
  from public.orders
  where id = new.order_id;

  if v_order_number is null then
    raise exception 'Commande introuvable pour le retour %', new.id;
  end if;

  v_reason := 'return_processed:' || new.id::text;

  if exists (
    select 1
    from public.stock_movements
    where source_module = 'retour'
      and product_id = new.product_id
      and reason = v_reason
  ) then
    return new;
  end if;

  update public.products
     set stock = stock + new.quantity,
         updated_at = now()
   where id = new.product_id;

  if not found then
    raise exception 'Produit introuvable pour le retour %', new.id;
  end if;

  update public.inventory
     set available_qty = available_qty + new.quantity,
         last_updated = now(),
         updated_at = now()
   where product_id = new.product_id
     and location = 'Warehouse-A';

  if not found then
    insert into public.inventory (product_id, location, available_qty, last_updated)
    values (new.product_id, 'Warehouse-A', new.quantity, now());
  end if;

  insert into public.stock_movements (
    product_id, type, quantity, comment, source_module, reason, created_by
  )
  values (
    new.product_id, 'entrée', new.quantity, v_order_number, 'retour', v_reason, auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists returns_apply_stock on public.returns;
create trigger returns_apply_stock
after insert or update of status on public.returns
for each row execute function public.apply_return_stock();