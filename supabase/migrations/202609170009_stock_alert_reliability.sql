alter table public.products
  alter column fixed_min_stock drop not null;

create or replace function public.queue_telegram_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_stock integer;
begin
  v_min_stock := public.get_product_min_stock(new);

  if v_min_stock is not null
     and new.stock <= v_min_stock
     and (
       tg_op = 'INSERT'
       or old.stock > coalesce(public.get_product_min_stock(old), -1)
       or old.stock_threshold_mode is distinct from new.stock_threshold_mode
       or old.fixed_min_stock is distinct from new.fixed_min_stock
       or old.dynamic_min_stock is distinct from new.dynamic_min_stock
     ) then
    insert into public.telegram_alert_queue (event_type, payload)
    values (
      'products.low_stock',
      jsonb_build_object(
        'table', 'products',
        'operation', 'low_stock',
        'new', jsonb_build_object(
          'id', new.id,
          'name', new.name,
          'sku', new.sku,
          'stock', new.stock,
          'minimum_stock', v_min_stock,
          'threshold_mode', new.stock_threshold_mode,
          'fixed_min_stock', new.fixed_min_stock
        )
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists telegram_products_low_stock_alert on public.products;
create trigger telegram_products_low_stock_alert
after insert or update of stock, dynamic_min_stock, stock_threshold_mode, fixed_min_stock
on public.products
for each row execute function public.queue_telegram_stock_alert();
