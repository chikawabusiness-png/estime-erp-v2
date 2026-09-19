create sequence if not exists public.product_sku_seq;

do $$
declare
  v_max_number integer;
begin
  select coalesce(max((match[1])::integer), 0)
  into v_max_number
  from public.products,
    lateral regexp_matches(sku, '^PERF-([0-9]+)-M[0-9]+$') as match;

  if v_max_number > 0 then
    perform setval('public.product_sku_seq', v_max_number, true);
  end if;
end;
$$;

create or replace function public.generate_product_sku(p_volume_ml integer)
returns text
language sql
as $$
  select 'PERF-' || lpad(nextval('public.product_sku_seq')::text, 3, '0')
    || '-M' || greatest(coalesce(p_volume_ml, 0), 0)::text;
$$;

create or replace function public.assign_product_sku()
returns trigger
language plpgsql
as $$
begin
  if new.sku is null or btrim(new.sku) = '' then
    new.sku := public.generate_product_sku(new.volume_ml);
  end if;
  return new;
end;
$$;

drop trigger if exists assign_product_sku_before_insert on public.products;
create trigger assign_product_sku_before_insert
before insert or update of sku on public.products
for each row execute function public.assign_product_sku();
