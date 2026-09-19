-- Keep finished-product stock and the default inventory location synchronized.

create or replace function public.sync_product_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory (product_id, location, available_qty, last_updated)
  values (new.id, 'Warehouse-A', new.stock, now())
  on conflict (product_id, location) do update
    set available_qty = excluded.available_qty,
        last_updated = now(),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_sync_inventory on public.products;
create trigger products_sync_inventory
after insert or update of stock on public.products
for each row execute function public.sync_product_inventory();

insert into public.inventory (product_id, location, available_qty, last_updated)
select p.id, 'Warehouse-A', p.stock, now()
from public.products p
where not exists (
  select 1
  from public.inventory i
  where i.product_id = p.id
    and i.location = 'Warehouse-A'
);

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_delta integer,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock integer;
  v_type text;
  v_source_module text;
begin
  if p_delta = 0 then
    raise exception 'p_delta must not be zero';
  end if;

  v_type := case when p_delta > 0 then 'entrée' else 'sortie' end;
  v_source_module := case
    when p_comment ilike 'Commande %' then 'sales'
    when p_comment ilike 'Production %' then 'production'
    when p_comment ilike 'Return %' then 'returns'
    else 'products'
  end;

  update public.products
     set stock = stock + p_delta,
         updated_at = now()
   where id = p_product_id
     and stock + p_delta >= 0
   returning stock into v_new_stock;

  if v_new_stock is null then
    if exists (select 1 from public.products where id = p_product_id) then
      raise exception 'Stock insuffisant pour le produit %', p_product_id;
    end if;
    raise exception 'Produit introuvable: %', p_product_id;
  end if;

  insert into public.stock_movements (
    product_id, type, quantity, comment, source_module, reason, created_by
  )
  values (
    p_product_id, v_type, abs(p_delta), p_comment, v_source_module, p_comment, auth.uid()
  );

  return v_new_stock;
end;
$$;
