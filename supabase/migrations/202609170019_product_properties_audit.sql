alter table public.products
  add column if not exists properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object');

create index if not exists products_properties_gin_idx
  on public.products using gin (properties);

create table if not exists public.product_audit_log (
  id bigint generated always as identity primary key,
  product_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references auth.users(id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists product_audit_log_product_id_idx
  on public.product_audit_log(product_id, changed_at desc);

alter table public.product_audit_log enable row level security;

drop policy if exists "product_audit_log_admin_select" on public.product_audit_log;
create policy "product_audit_log_admin_select"
on public.product_audit_log for select
using (public.is_admin());

create or replace function public.audit_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_audit_log (product_id, action, changed_by, old_data, new_data)
  values (
    coalesce(new.id, old.id),
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_audit_log on public.products;
create trigger products_audit_log
after insert or update or delete on public.products
for each row execute function public.audit_product_changes();
