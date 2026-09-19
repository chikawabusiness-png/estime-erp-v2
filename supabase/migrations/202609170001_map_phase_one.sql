-- ============================================================
-- Perfume Shop ERP — MAP phase-one expansion
-- Adds procurement, production, inventory, logistics and finance
-- tables without changing the initial schema.
-- ============================================================

-- ---------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('production', 'sales', 'logistics', 'warehouse', 'finance', 'admin')),
  email text,
  phone text,
  hire_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- raw materials and purchases
-- ---------------------------------------------------------------
create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  cost_per_unit numeric(12,3) not null default 0 check (cost_per_unit >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  stock_qty numeric(12,3) not null default 0 check (stock_qty >= 0),
  reorder_level numeric(12,3) not null default 0 check (reorder_level >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  material_id uuid not null references public.raw_materials(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,3) not null check (unit_price >= 0),
  total_price numeric(14,3) generated always as (quantity * unit_price) stored,
  received_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('draft', 'received', 'cancelled')),
  notes text,
  received_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- production and finished-goods inventory
-- ---------------------------------------------------------------
create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_produced integer not null check (quantity_produced > 0),
  date_started timestamptz not null default now(),
  date_completed timestamptz,
  raw_materials_used jsonb not null default '[]'::jsonb
    check (jsonb_typeof(raw_materials_used) = 'array'),
  operator_id uuid references public.employees(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_completed is null or date_completed >= date_started)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  location text not null default 'Warehouse-A',
  available_qty integer not null default 0 check (available_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, location)
);

-- ---------------------------------------------------------------
-- orders, delivery and finance
-- ---------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_date timestamptz not null default now(),
  method text not null check (method in ('cash', 'card', 'transfer', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  notes text,
  recorded_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier text,
  tracking_number text,
  dispatch_date timestamptz,
  expected_delivery timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'dispatched', 'in_transit', 'delivered', 'failed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_delivery is null or dispatch_date is null or expected_delivery >= dispatch_date)
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason text not null,
  return_date timestamptz not null default now(),
  processed_by uuid references public.employees(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  date_incurred date not null default current_date,
  description text,
  recorded_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchases_material_id_idx on public.purchases(material_id);
create index if not exists production_batches_product_id_idx on public.production_batches(product_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists returns_order_id_idx on public.returns(order_id);
create index if not exists expenses_date_incurred_idx on public.expenses(date_incurred);

-- Keep modification timestamps consistent with the initial schema.
create or replace function public.set_map_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'employees', 'raw_materials', 'purchases', 'production_batches',
    'inventory', 'payments', 'deliveries', 'returns', 'expenses'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_map_updated_at()',
      v_table, v_table
    );
  end loop;
end;
$$;

-- A received purchase changes raw-material stock exactly once per state/value.
create or replace function public.apply_purchase_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_delta numeric(12,3) := 0;
  v_new_delta numeric(12,3) := 0;
begin
  if tg_op <> 'INSERT' and old.status = 'received' then
    v_old_delta := old.quantity;
  end if;
  if new.status = 'received' then
    v_new_delta := new.quantity;
  end if;

  if tg_op <> 'INSERT' and old.status = 'received' and new.material_id <> old.material_id then
    update public.raw_materials
       set stock_qty = stock_qty - v_old_delta, updated_at = now()
     where id = old.material_id;
    v_old_delta := 0;
  end if;

  if tg_op <> 'INSERT' and new.status = 'received' and new.material_id <> old.material_id then
    update public.raw_materials
       set stock_qty = stock_qty + v_new_delta, updated_at = now()
     where id = new.material_id;
    v_new_delta := 0;
  end if;

  if tg_op = 'INSERT' or old.material_id = new.material_id then
    update public.raw_materials
       set stock_qty = stock_qty + v_new_delta - v_old_delta, updated_at = now()
     where id = new.material_id;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_apply_stock on public.purchases;
create trigger purchases_apply_stock
after insert or update of material_id, quantity, status on public.purchases
for each row execute function public.apply_purchase_stock();

-- Completes a batch, consumes the JSONB material list, and updates both
-- the new location-aware inventory and the legacy products.stock column.
create or replace function public.complete_production_batch(p_batch_id uuid)
returns public.production_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.production_batches;
  v_material jsonb;
  v_material_id uuid;
  v_quantity numeric(12,3);
begin
  select * into v_batch from public.production_batches where id = p_batch_id for update;
  if not found then raise exception 'Production batch not found: %', p_batch_id; end if;
  if v_batch.status <> 'planned' then raise exception 'Batch is not planned: %', p_batch_id; end if;

  for v_material in select value from jsonb_array_elements(v_batch.raw_materials_used) loop
    v_material_id := (v_material->>'raw_material_id')::uuid;
    v_quantity := (v_material->>'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Invalid raw material quantity in batch %', p_batch_id;
    end if;
    update public.raw_materials
       set stock_qty = stock_qty - v_quantity, updated_at = now()
     where id = v_material_id and stock_qty >= v_quantity;
    if not found then raise exception 'Insufficient raw material stock: %', v_material_id; end if;
  end loop;

  insert into public.inventory (product_id, available_qty, last_updated)
  values (v_batch.product_id, v_batch.quantity_produced, now())
  on conflict (product_id, location) do update
    set available_qty = public.inventory.available_qty + excluded.available_qty,
        last_updated = now(), updated_at = now();
  perform public.adjust_stock(v_batch.product_id, v_batch.quantity_produced, 'Production batch ' || p_batch_id);

  update public.production_batches
     set status = 'completed', date_completed = now(), updated_at = now()
   where id = p_batch_id
   returning * into v_batch;
  return v_batch;
end;
$$;

-- Process a return atomically and restore finished-goods stock. The caller
-- records a pending return first, allowing rejected returns to remain
-- auditable without changing inventory.
create or replace function public.process_return(p_return_id uuid)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.returns;
begin
  select * into v_return from public.returns where id = p_return_id for update;
  if not found then raise exception 'Return not found: %', p_return_id; end if;
  if v_return.status <> 'pending' then raise exception 'Return is not pending: %', p_return_id; end if;

  insert into public.inventory (product_id, available_qty, last_updated)
  values (v_return.product_id, v_return.quantity, now())
  on conflict (product_id, location) do update
    set available_qty = public.inventory.available_qty + excluded.available_qty,
        last_updated = now(), updated_at = now();
  perform public.adjust_stock(v_return.product_id, v_return.quantity, 'Return ' || p_return_id);

  update public.returns
     set status = 'processed',
         processed_by = coalesce(
           processed_by,
           (select id from public.employees where profile_id = auth.uid())
         ),
         updated_at = now()
   where id = p_return_id
   returning * into v_return;
  return v_return;
end;
$$;

-- ---------------------------------------------------------------
-- Row Level Security: authenticated reads, admin writes, with
-- authenticated inserts for operational records used by the app.
-- ---------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.raw_materials enable row level security;
alter table public.purchases enable row level security;
alter table public.production_batches enable row level security;
alter table public.inventory enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.returns enable row level security;
alter table public.expenses enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'employees', 'raw_materials', 'purchases', 'production_batches',
    'inventory', 'payments', 'deliveries', 'returns', 'expenses'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_select_authenticated', v_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_write_admin', v_table
    );
    execute format(
      'create policy %I on public.%I for select using (auth.role() = ''authenticated'')',
      v_table || '_select_authenticated', v_table
    );
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      v_table || '_write_admin', v_table
    );
  end loop;
end;
$$;

drop policy if exists "purchases_insert_authenticated" on public.purchases;
create policy "purchases_insert_authenticated" on public.purchases
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "production_batches_insert_authenticated" on public.production_batches;
create policy "production_batches_insert_authenticated" on public.production_batches
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "payments_insert_authenticated" on public.payments;
create policy "payments_insert_authenticated" on public.payments
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "deliveries_insert_authenticated" on public.deliveries;
create policy "deliveries_insert_authenticated" on public.deliveries
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "returns_insert_authenticated" on public.returns;
create policy "returns_insert_authenticated" on public.returns
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "expenses_insert_authenticated" on public.expenses;
create policy "expenses_insert_authenticated" on public.expenses
  for insert with check (auth.role() = 'authenticated');

revoke all on function public.complete_production_batch(uuid) from public;
grant execute on function public.complete_production_batch(uuid) to authenticated;
revoke all on function public.process_return(uuid) from public;
grant execute on function public.process_return(uuid) to authenticated;
