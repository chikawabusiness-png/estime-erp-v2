create or replace function public.change_orders_status_with_stock(
  p_order_ids uuid[],
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Aucune commande sélectionnée';
  end if;

  foreach v_order_id in array p_order_ids loop
    perform public.change_order_status_with_stock(v_order_id, p_status);
  end loop;
end;
$$;

grant execute on function public.change_orders_status_with_stock(uuid[], text)
to anon, authenticated;

notify pgrst, 'reload schema';
