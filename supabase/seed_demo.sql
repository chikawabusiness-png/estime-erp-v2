-- Demo data for local/testing environments.
-- Run after 20241001_init_schema.sql and after creating a Supabase Auth user.

insert into public.customers (full_name, email, phone, address)
select v.full_name, v.email, v.phone, v.address
from (values
  ('Amine Benali', 'amine.benali@example.com', '+212 600 000 001', '12 rue des Roses, Casablanca'),
  ('Sara El Mansouri', 'sara.mansouri@example.com', '+212 600 000 002', '8 avenue Mohammed V, Rabat'),
  ('Youssef Alaoui', 'youssef.alaoui@example.com', '+212 600 000 003', '25 boulevard Zerktouni, Marrakech')
) as v(full_name, email, phone, address)
where not exists (
  select 1 from public.customers c where c.email = v.email
);

insert into public.suppliers (name, email, phone, address)
select v.name, v.email, v.phone, v.address
from (values
  ('Maison Oud', 'contact@maison-oud.example', '+212 500 000 001', 'Zone industrielle, Casablanca'),
  ('Essences du Maroc', 'contact@essences-maroc.example', '+212 500 000 002', 'Ain Sebaa, Casablanca')
) as v(name, email, phone, address)
where not exists (
  select 1 from public.suppliers s where s.email = v.email
);

insert into public.products (name, sku, description, price, stock)
values
  ('Oud Royal', 'PAR-OUD-001', 'Parfum boise intense 50 ml', 89.90, 24),
  ('Rose d''Atlas', 'PAR-ROS-001', 'Eau de parfum florale 50 ml', 74.50, 18),
  ('Ambre Vanille', 'PAR-AMB-001', 'Parfum ambre et vanille 100 ml', 99.00, 12),
  ('Musc Blanc', 'PAR-MUS-001', 'Parfum doux et musque 50 ml', 65.00, 30)
on conflict (sku) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  stock = excluded.stock,
  updated_at = now();

with app_user as (
  select id
  from auth.users
  where email = 'youssef@gmail.com'
  limit 1
),
customer_row as (
  select id
  from public.customers
  where email = 'amine.benali@example.com'
  limit 1
)
insert into public.orders (customer_id, created_by, status)
select customer_row.id, app_user.id, 'confirmé'
from customer_row
cross join app_user
where not exists (
  select 1
  from public.orders o
  where o.customer_id = customer_row.id
    and o.created_by = app_user.id
    and o.status = 'confirmé'
);

with order_row as (
  select o.id
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where c.email = 'amine.benali@example.com'
    and o.status = 'confirmé'
  order by o.created_at desc
  limit 1
),
product_row as (
  select id, price
  from public.products
  where sku = 'PAR-OUD-001'
  limit 1
)
insert into public.order_items (order_id, product_id, quantity, unit_price)
select order_row.id, product_row.id, 2, product_row.price
from order_row
cross join product_row
where not exists (
  select 1
  from public.order_items oi
  where oi.order_id = order_row.id
    and oi.product_id = product_row.id
);

with order_row as (
  select o.id
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where c.email = 'amine.benali@example.com'
    and o.status = 'confirmé'
  order by o.created_at desc
  limit 1
),
order_total as (
  select coalesce(sum(total_price), 0) as amount
  from public.order_items oi
  join order_row on order_row.id = oi.order_id
)
insert into public.invoices (order_id, amount)
select order_row.id, order_total.amount
from order_row
cross join order_total
where not exists (
  select 1
  from public.invoices i
  where i.order_id = order_row.id
);

with app_user as (
  select id
  from auth.users
  where email = 'youssef@gmail.com'
  limit 1
),
product_row as (
  select id
  from public.products
  where sku = 'PAR-ROS-001'
  limit 1
)
insert into public.stock_movements (product_id, type, quantity, comment, created_by)
select product_row.id, 'entrée', 10, 'Stock initial de démonstration', app_user.id
from product_row
cross join app_user
where not exists (
  select 1
  from public.stock_movements sm
  where sm.product_id = product_row.id
    and sm.comment = 'Stock initial de démonstration'
);
