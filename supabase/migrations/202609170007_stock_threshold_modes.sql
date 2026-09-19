alter table public.products
  add column if not exists stock_threshold_mode text not null default 'dynamic'
    check (stock_threshold_mode in ('dynamic', 'fixed')),
  add column if not exists fixed_min_stock integer not null default 0
    check (fixed_min_stock >= 0);

create or replace function public.get_product_min_stock(p_product public.products)
returns integer
language sql
immutable
as $$
  select case
    when p_product.stock_threshold_mode = 'fixed' then p_product.fixed_min_stock
    else p_product.dynamic_min_stock
  end;
$$;

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

  if new.stock <= v_min_stock
     and (
       old.stock > public.get_product_min_stock(old)
       or old.stock_threshold_mode <> new.stock_threshold_mode
       or old.fixed_min_stock <> new.fixed_min_stock
       or old.dynamic_min_stock <> new.dynamic_min_stock
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
          'dynamic_min_stock', new.dynamic_min_stock,
          'fixed_min_stock', new.fixed_min_stock,
          'demand_window_days', new.demand_window_days,
          'lead_time_days', new.lead_time_days,
          'safety_stock_percent', new.safety_stock_percent
        )
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists telegram_products_low_stock_alert on public.products;
create trigger telegram_products_low_stock_alert
after update of stock, dynamic_min_stock, stock_threshold_mode, fixed_min_stock on public.products
for each row execute function public.queue_telegram_stock_alert();

do $$
declare
  product_id uuid;
begin
  for product_id in select id from public.products loop
    perform public.recalculate_product_min_stock(product_id);
  end loop;
end;
$$;
