update public.products
set fixed_min_stock = dynamic_min_stock,
    stock_threshold_mode = 'fixed'
where stock_threshold_mode = 'dynamic';

alter table public.products
  drop constraint if exists products_stock_threshold_mode_check;

alter table public.products
  add constraint products_stock_threshold_mode_check
  check (stock_threshold_mode = 'fixed');

alter table public.products
  alter column stock_threshold_mode set default 'fixed';
