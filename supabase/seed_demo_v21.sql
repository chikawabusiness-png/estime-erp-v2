-- Idempotent demonstration data for a fresh Estime Parfum ERP project.
-- This seed does not create Auth users. Run it after applying migrations.

insert into public.suppliers (name, email, phone, address)
select v.name, v.email, v.phone, v.address
from (values
  ('Maison Oud', 'contact@maison-oud.example', '+212 522 10 20 30', 'Casablanca'),
  ('Essences du Maroc', 'contact@essences-maroc.example', '+212 535 20 30 40', 'Fès'),
  ('Packaging Atlas', 'contact@packaging-atlas.example', '+212 524 30 40 50', 'Marrakech')
) as v(name, email, phone, address)
where not exists (
  select 1 from public.suppliers s where s.email = v.email
);

insert into public.customers (full_name, email, phone, address)
select v.full_name, v.email, v.phone, v.address
from (values
  ('Amine Benali', 'amine.benali@example.com', '+212 600 000 001', '12 rue des Roses, Casablanca'),
  ('Sara El Mansouri', 'sara.mansouri@example.com', '+212 600 000 002', '8 avenue Mohammed V, Rabat'),
  ('Youssef Alaoui', 'youssef.alaoui@example.com', '+212 600 000 003', '25 boulevard Zerktouni, Marrakech'),
  ('Khadija Berrada', 'khadija.berrada@example.com', '+212 600 000 004', '4 rue Ibn Sina, Tanger'),
  ('Omar Tazi', 'omar.tazi@example.com', '+212 600 000 005', '19 avenue Hassan II, Agadir')
) as v(full_name, email, phone, address)
where not exists (
  select 1 from public.customers c where c.email = v.email
);

insert into public.products (name, sku, description, price, stock, volume_ml)
values
  ('Oud Royal', 'PAR-OUD-001', 'Parfum boisé intense', 89.90, 24, 50),
  ('Rose d''Atlas', 'PAR-ROS-001', 'Eau de parfum florale', 74.50, 16, 50),
  ('Ambre Vanille', 'PAR-AMB-001', 'Parfum ambré et vanillé', 99.00, 11, 100),
  ('Musc Blanc', 'PAR-MUS-001', 'Parfum doux et musqué', 65.00, 30, 50),
  ('Santal Impérial', 'PAR-SAN-001', 'Parfum boisé élégant', 110.00, 8, 100),
  ('Fleur d''Oranger', 'PAR-FLO-001', 'Eau de parfum fraîche', 79.00, 21, 50)
on conflict (sku) do update
set name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    stock = excluded.stock,
    volume_ml = excluded.volume_ml,
    updated_at = now();

insert into public.raw_materials (name, unit, cost_per_unit, supplier_id, stock_qty, reorder_level)
select v.name, v.unit, v.cost_per_unit, s.id, v.stock_qty, v.reorder_level
from (values
  ('Alcool parfumeur 96°', 'L', 18.500, 'contact@essences-maroc.example', 115.000, 20.000),
  ('Concentré rose', 'kg', 420.000, 'contact@maison-oud.example', 1.512, 0.300),
  ('Concentré oud', 'kg', 680.000, 'contact@maison-oud.example', 1.800, 0.300),
  ('Flacons verre 50 ml', 'pcs', 4.500, 'contact@packaging-atlas.example', 900.000, 200.000),
  ('Vaporisateurs', 'pcs', 1.800, 'contact@packaging-atlas.example', 300.000, 500.000),
  ('Boîtes cartonnées', 'pcs', 2.200, 'contact@packaging-atlas.example', 700.000, 200.000)
) as v(name, unit, cost_per_unit, supplier_email, stock_qty, reorder_level)
join public.suppliers s on s.email = v.supplier_email
where not exists (
  select 1 from public.raw_materials m where m.name = v.name
);

insert into public.inventory (product_id, location, available_qty, reorder_level)
select p.id, 'Warehouse-A', p.stock, 5
from public.products p
where p.sku in ('PAR-OUD-001', 'PAR-ROS-001', 'PAR-AMB-001', 'PAR-MUS-001', 'PAR-SAN-001', 'PAR-FLO-001')
on conflict (product_id, location) do update
set available_qty = excluded.available_qty, reorder_level = excluded.reorder_level, updated_at = now();

insert into public.purchases (supplier_id, material_id, quantity, unit_price, status, notes)
select s.id, m.id, 100, m.cost_per_unit, 'received', 'Réception initiale de démonstration'
from public.suppliers s
join public.raw_materials m on m.supplier_id = s.id
where s.email = 'contact@essences-maroc.example'
  and m.name = 'Alcool parfumeur 96°'
  and not exists (
    select 1 from public.purchases p where p.material_id = m.id and p.notes = 'Réception initiale de démonstration'
  );

insert into public.orders (customer_id, status)
select c.id, v.status
from (values
  ('amine.benali@example.com', 'confirmé'),
  ('sara.mansouri@example.com', 'livré'),
  ('khadija.berrada@example.com', 'draft')
) as v(customer_email, status)
join public.customers c on c.email = v.customer_email
where not exists (
  select 1 from public.orders o
  where o.customer_id = c.id and o.status = v.status and o.created_at > now() - interval '1 day'
);

insert into public.order_items (order_id, product_id, quantity, unit_price)
select o.id, p.id, v.quantity, p.price
from (values
  ('amine.benali@example.com', 'PAR-OUD-001', 2),
  ('sara.mansouri@example.com', 'PAR-ROS-001', 1),
  ('khadija.berrada@example.com', 'PAR-AMB-001', 1)
) as v(customer_email, sku, quantity)
join public.customers c on c.email = v.customer_email
join lateral (
  select id from public.orders
  where customer_id = c.id
  order by created_at desc
  limit 1
) o on true
join public.products p on p.sku = v.sku
where not exists (
  select 1 from public.order_items oi where oi.order_id = o.id and oi.product_id = p.id
);

insert into public.invoices (order_id, amount)
select o.id, coalesce(sum(oi.total_price), 0)
from public.orders o
join public.customers c on c.id = o.customer_id
join public.order_items oi on oi.order_id = o.id
where c.email in ('amine.benali@example.com', 'sara.mansouri@example.com')
  and not exists (select 1 from public.invoices i where i.order_id = o.id)
group by o.id;
