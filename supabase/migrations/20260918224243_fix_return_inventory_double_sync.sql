-- Product stock synchronization already updates the default inventory row.
-- Keep the return trigger focused on the product stock and movement log.
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

  insert into public.stock_movements (
    product_id, type, quantity, comment, source_module, reason, created_by
  )
  values (
    new.product_id, 'entrée', new.quantity, v_order_number, 'retour', v_reason, auth.uid()
  );

  return new;
end;
$$;