alter table public.products
  add column if not exists demand_window_days integer not null default 30
    check (demand_window_days between 7 and 365),
  add column if not exists lead_time_days integer not null default 7
    check (lead_time_days between 0 and 365),
  add column if not exists safety_stock_percent numeric(5,2) not null default 20
    check (safety_stock_percent between 0 and 200),
  add column if not exists dynamic_min_stock integer not null default 0
    check (dynamic_min_stock >= 0);

create or replace function public.recalculate_product_min_stock(p_product_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window integer;
  v_lead_time integer;
  v_safety numeric;
  v_demand numeric;
  v_minimum integer;
begin
  select demand_window_days, lead_time_days, safety_stock_percent
    into v_window, v_lead_time, v_safety
  from public.products
  where id = p_product_id;

  if not found then
    return null;
  end if;

  select coalesce(sum(oi.quantity), 0)::numeric / greatest(v_window, 1)
    into v_demand
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.status <> 'annulé'
    and o.created_at >= now() - make_interval(days => v_window);

  v_minimum := greatest(
    0,
    ceil(v_demand * v_lead_time * (1 + v_safety / 100))::integer
  );

  update public.products
  set dynamic_min_stock = v_minimum,
      updated_at = now()
  where id = p_product_id;

  return v_minimum;
end;
$$;

create or replace function public.recalculate_product_min_stock_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_product_min_stock(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_product_min_stock_from_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_product_min_stock(new.id);
  return new;
end;
$$;

drop trigger if exists recalculate_product_min_stock_order_item on public.order_items;
create trigger recalculate_product_min_stock_order_item
after insert or update of product_id, quantity or delete on public.order_items
for each row execute function public.recalculate_product_min_stock_from_order();

drop trigger if exists recalculate_product_min_stock_product on public.products;
create trigger recalculate_product_min_stock_product
after update of demand_window_days, lead_time_days, safety_stock_percent on public.products
for each row execute function public.recalculate_product_min_stock_from_product();

create or replace function public.queue_telegram_stock_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock <= new.dynamic_min_stock
     and (old.stock > old.dynamic_min_stock or old.dynamic_min_stock <> new.dynamic_min_stock) then
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
          'dynamic_min_stock', new.dynamic_min_stock,
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
after update of stock, dynamic_min_stock on public.products
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
