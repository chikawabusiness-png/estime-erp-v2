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
  if p_status not in ('draft', 'confirmé', 'livré', 'annulé', 'retourné') then
    raise exception 'Statut de commande invalide';
  end if;

  select status into v_current_status
  from public.orders where id = p_order_id for update;

  if not found then raise exception 'Commande introuvable'; end if;
  if v_current_status = p_status then return; end if;

  if v_current_status not in ('annulé', 'retourné')
     and p_status in ('annulé', 'retourné') then
    for v_item in select product_id, sum(quantity)::integer quantity
      from public.order_items where order_id = p_order_id group by product_id loop
      update public.products set stock = stock + v_item.quantity, updated_at = now()
      where id = v_item.product_id;
      insert into public.stock_movements (product_id, type, quantity, comment, created_by)
      values (v_item.product_id, 'entrée', v_item.quantity,
        case when p_status = 'retourné' then 'Retour commande #' else 'Annulation commande #' end
        || left(p_order_id::text, 8), auth.uid());
    end loop;
  elsif v_current_status in ('annulé', 'retourné')
        and p_status not in ('annulé', 'retourné') then
    for v_item in select product_id, sum(quantity)::integer quantity
      from public.order_items where order_id = p_order_id group by product_id loop
      update public.products set stock = stock - v_item.quantity, updated_at = now()
      where id = v_item.product_id and stock >= v_item.quantity;
      if not found then raise exception 'Stock insuffisant pour réactiver la commande'; end if;
      insert into public.stock_movements (product_id, type, quantity, comment, created_by)
      values (v_item.product_id, 'sortie', v_item.quantity,
        'Réactivation commande #' || left(p_order_id::text, 8), auth.uid());
    end loop;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$$;
