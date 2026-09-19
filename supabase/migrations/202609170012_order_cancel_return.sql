alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('draft', 'confirmé', 'livré', 'annulé', 'retourné'));

create or replace function public.change_order_status_with_stock(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_item record;
begin
  if p_status not in ('annulé', 'retourné') then
    raise exception 'Statut de retour invalide';
  end if;

  select status into v_current_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_current_status in ('annulé', 'retourné') then
    raise exception 'Cette commande est déjà %', v_current_status;
  end if;

  for v_item in
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id
  loop
    update public.products
    set stock = stock + v_item.quantity,
        updated_at = now()
    where id = v_item.product_id;

    insert into public.stock_movements (product_id, type, quantity, comment, created_by)
    values (
      v_item.product_id,
      'entrée',
      v_item.quantity,
      case when p_status = 'retourné'
        then 'Retour commande #' || left(p_order_id::text, 8)
        else 'Annulation commande #' || left(p_order_id::text, 8)
      end,
      auth.uid()
    );
  end loop;

  update public.orders
  set status = p_status,
      updated_at = now()
  where id = p_order_id;
end;
$$;
