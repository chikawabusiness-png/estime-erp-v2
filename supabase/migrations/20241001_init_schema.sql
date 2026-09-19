-- ============================================================
-- Perfume Shop ERP — initial schema
-- ============================================================
-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'vendeur' check (role in ('admin', 'vendeur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- products
-- ---------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'confirmé', 'livré', 'annulé')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- stock_movements
-- ---------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('entrée', 'sortie')),
  quantity integer not null check (quantity > 0),
  comment text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  pdf_path text,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- adjust_stock: atomically adjusts stock and logs the movement
-- ============================================================
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
begin
  if p_delta = 0 then
    raise exception 'p_delta must not be zero';
  end if;

  v_type := case when p_delta > 0 then 'entrée' else 'sortie' end;

  update public.products
     set stock = stock + p_delta,
         updated_at = now()
   where id = p_product_id
   returning stock into v_new_stock;

  if v_new_stock is null then
    raise exception 'Produit introuvable: %', p_product_id;
  end if;

  if v_new_stock < 0 then
    raise exception 'Stock insuffisant pour le produit %', p_product_id;
  end if;

  insert into public.stock_movements (product_id, type, quantity, comment, created_by)
  values (p_product_id, v_type, abs(p_delta), p_comment, auth.uid());

  return v_new_stock;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.invoices enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: a user can read/update their own row; admins can read/update all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- products: any authenticated user can read; only admins can write
create policy "products_select_authenticated" on public.products
  for select using (auth.role() = 'authenticated');
create policy "products_write_admin" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- customers: any authenticated user can read/write
create policy "customers_all_authenticated" on public.customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- suppliers: read for all authenticated, write for admins
create policy "suppliers_select_authenticated" on public.suppliers
  for select using (auth.role() = 'authenticated');
create policy "suppliers_write_admin" on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: any authenticated user can read/create; only admins can delete/update status to annulé
create policy "orders_select_authenticated" on public.orders
  for select using (auth.role() = 'authenticated');
create policy "orders_insert_authenticated" on public.orders
  for insert with check (auth.role() = 'authenticated');
create policy "orders_update_own_or_admin" on public.orders
  for update using (created_by = auth.uid() or public.is_admin());
create policy "orders_delete_admin" on public.orders
  for delete using (public.is_admin());

-- order_items: follow parent order visibility
create policy "order_items_select_authenticated" on public.order_items
  for select using (auth.role() = 'authenticated');
create policy "order_items_write_authenticated" on public.order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- stock_movements: read for all authenticated; insert via RPC (security definer) or admin
create policy "stock_movements_select_authenticated" on public.stock_movements
  for select using (auth.role() = 'authenticated');
create policy "stock_movements_insert_admin" on public.stock_movements
  for insert with check (public.is_admin());

-- invoices: read for all authenticated; write for admins
create policy "invoices_select_authenticated" on public.invoices
  for select using (auth.role() = 'authenticated');
create policy "invoices_write_admin" on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage bucket for product images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product_images_admin_write" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
