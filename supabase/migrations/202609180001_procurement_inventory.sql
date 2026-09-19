-- Connect received purchases to raw-material inventory with batch traceability.

alter table public.purchases
  add column if not exists batch_number text;

alter table public.inventory
  alter column product_id drop not null;

alter table public.inventory
  add column if not exists raw_material_id uuid references public.raw_materials(id) on delete restrict,
  add column if not exists batch_number text,
  add column if not exists unit_cost numeric(12,3) check (unit_cost is null or unit_cost >= 0);

alter table public.inventory
  drop constraint if exists inventory_item_check;

alter table public.inventory
  add constraint inventory_item_check
  check ((product_id is not null and raw_material_id is null) or
         (product_id is null and raw_material_id is not null));

create unique index if not exists inventory_raw_material_location_batch_key
  on public.inventory (raw_material_id, location, coalesce(batch_number, ''))
  where raw_material_id is not null;

alter table public.stock_movements
  alter column product_id drop not null;

alter table public.stock_movements
  add column if not exists raw_material_id uuid references public.raw_materials(id) on delete restrict,
  add column if not exists batch_number text,
  add column if not exists source_module text,
  add column if not exists reason text,
  add column if not exists unit_cost numeric(12,3);

alter table public.stock_movements
  drop constraint if exists stock_movements_item_check;

alter table public.stock_movements
  add constraint stock_movements_item_check
  check ((product_id is not null and raw_material_id is null) or
         (product_id is null and raw_material_id is not null));

create or replace function public.apply_purchase_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_delta numeric(12,3) := 0;
  v_new_delta numeric(12,3) := 0;
  v_old_material uuid;
  v_old_batch text;
  v_new_batch text;
begin
  if tg_op <> 'INSERT' and old.status = 'received' then
    v_old_delta := old.quantity;
    v_old_material := old.material_id;
    v_old_batch := old.batch_number;
  end if;

  if new.status = 'received' then
    v_new_delta := new.quantity;
    v_new_batch := new.batch_number;
  end if;

  if v_old_delta > 0 then
    update public.raw_materials
       set stock_qty = stock_qty - v_old_delta, updated_at = now()
     where id = v_old_material and stock_qty >= v_old_delta;
    if not found then
      raise exception 'Impossible d''annuler la réception : stock insuffisant pour la matière %', v_old_material;
    end if;

    update public.inventory
       set available_qty = available_qty - v_old_delta,
           last_updated = now(),
           updated_at = now()
     where raw_material_id = v_old_material
       and location = 'Warehouse-A'
       and coalesce(batch_number, '') = coalesce(v_old_batch, '')
       and available_qty >= v_old_delta;
    if not found then
      raise exception 'Inventaire introuvable pour la réception à annuler: %', old.id;
    end if;

    insert into public.stock_movements (
      raw_material_id, type, quantity, batch_number, source_module, reason, unit_cost, created_by
    )
    values (
      v_old_material, 'sortie', v_old_delta, v_old_batch, 'purchases',
      'purchase_reversed', old.unit_price,
      (select id from public.profiles where id = auth.uid())
    );
  end if;

  if v_new_delta > 0 then
    update public.raw_materials
       set stock_qty = stock_qty + v_new_delta,
           cost_per_unit = new.unit_price,
           updated_at = now()
     where id = new.material_id;
    if not found then
      raise exception 'Matière première introuvable: %', new.material_id;
    end if;

    insert into public.inventory (
      raw_material_id, location, available_qty, batch_number, unit_cost, last_updated
    )
    values (
      new.material_id, 'Warehouse-A', v_new_delta, new.batch_number, new.unit_price, now()
    )
    on conflict (raw_material_id, location, (coalesce(batch_number, ''))) where raw_material_id is not null
    do update set
      available_qty = public.inventory.available_qty + excluded.available_qty,
      unit_cost = excluded.unit_cost,
      last_updated = now(),
      updated_at = now();

    insert into public.stock_movements (
      raw_material_id, type, quantity, batch_number, source_module, reason, unit_cost, created_by
    )
    values (
      new.material_id, 'entrée', v_new_delta, new.batch_number, 'purchases',
      'purchase_received', new.unit_price,
      (select id from public.profiles where id = auth.uid())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists purchases_apply_stock on public.purchases;
create trigger purchases_apply_stock
after insert or update of material_id, quantity, unit_price, batch_number, status on public.purchases
for each row execute function public.apply_purchase_stock();
