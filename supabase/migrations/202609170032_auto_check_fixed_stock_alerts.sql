create table if not exists public.product_low_stock_alert_state (
  product_id uuid primary key references public.products(id) on delete cascade,
  is_low boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.product_low_stock_alert_state enable row level security;

create or replace function public.check_fixed_stock_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_min_stock integer;
  v_is_low boolean;
  v_was_low boolean;
  v_alerts integer := 0;
begin
  for v_product in
    select id, name, sku, stock, fixed_min_stock, stock_threshold_mode
    from public.products
  loop
    v_min_stock := case
      when v_product.stock_threshold_mode = 'fixed' then v_product.fixed_min_stock
      else null
    end;

    v_is_low := v_min_stock is not null and v_product.stock <= v_min_stock;

    select is_low
      into v_was_low
    from public.product_low_stock_alert_state
    where product_id = v_product.id
    for update;

    if v_is_low and coalesce(v_was_low, false) = false then
      insert into public.telegram_alert_queue (event_type, payload)
      values (
        'products.low_stock',
        jsonb_build_object(
          'table', 'products',
          'operation', 'low_stock',
          'new', jsonb_build_object(
            'id', v_product.id,
            'name', v_product.name,
            'sku', v_product.sku,
            'stock', v_product.stock,
            'minimum_stock', v_min_stock,
            'threshold_mode', v_product.stock_threshold_mode,
            'fixed_min_stock', v_product.fixed_min_stock
          )
        )
      );
      v_alerts := v_alerts + 1;
    end if;

    insert into public.product_low_stock_alert_state (product_id, is_low, checked_at)
    values (v_product.id, v_is_low, now())
    on conflict (product_id) do update
      set is_low = excluded.is_low,
          checked_at = excluded.checked_at;
  end loop;

  return v_alerts;
end;
$$;

grant execute on function public.check_fixed_stock_alerts()
to service_role;

select public.check_fixed_stock_alerts();

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'check-fixed-stock-alerts'
  ) then
    perform cron.schedule(
      'check-fixed-stock-alerts',
      '*/10 * * * *',
      $job$select public.check_fixed_stock_alerts();$job$
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
