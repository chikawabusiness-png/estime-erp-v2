alter table public.products
  add column if not exists volume_ml integer
    check (volume_ml is null or volume_ml > 0);
