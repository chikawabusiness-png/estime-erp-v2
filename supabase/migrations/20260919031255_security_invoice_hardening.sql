-- Prevent self-service privilege escalation through profiles.role.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.role := 'vendeur';
    elsif new.role is distinct from old.role then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_escalation() from public, anon, authenticated;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before insert or update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

-- Allow a user to create an invoice only for an order they created.
drop policy if exists "invoices_insert_authenticated" on public.invoices;
create policy "invoices_insert_authenticated" on public.invoices
  for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.orders
      where orders.id = invoices.order_id
        and orders.created_by = (select auth.uid())
    )
  );

-- Recompute the invoice total and stock changes in one database transaction.
create or replace function public.create_manual_invoice(
  p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_invoice_id uuid;
  v_total numeric(10, 2);
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_price numeric(10, 2);
  v_stock integer;
begin
  if (auth.uid() is null) then
    raise exception 'Authentification requise';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La facture doit contenir au moins un produit';
  end if;

  insert into public.orders (customer_id, status, priority, properties, created_by)
  values (p_customer_id, 'confirmé', 'normale', jsonb_build_object('source', 'facture_manuelle'), auth.uid())
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Produit ou quantité invalide';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La quantité doit être supérieure à zéro';
    end if;

    select price, stock
      into v_price, v_stock
      from public.products
      where id = v_product_id
      for share;

    if not found then
      raise exception 'Produit introuvable';
    end if;

    if v_quantity > v_stock then
      raise exception 'Stock insuffisant pour le produit %', v_product_id;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product_id, v_quantity, v_price);

    perform public.adjust_stock(
      v_product_id,
      -v_quantity,
      format('Facture manuelle %s', v_order_id)
    );
  end loop;

  select coalesce(sum(quantity * unit_price), 0)::numeric(10, 2)
    into v_total
    from public.order_items
    where order_id = v_order_id;

  insert into public.invoices (order_id, amount)
  values (v_order_id, v_total)
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_manual_invoice(uuid, jsonb) from public, anon;
grant execute on function public.create_manual_invoice(uuid, jsonb) to authenticated;
