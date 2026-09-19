create or replace function public.mark_due_deliveries_as_delivered()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.deliveries
  set status = 'delivered',
      updated_at = now()
  where expected_delivery is not null
    and expected_delivery <= now()
    and status in ('pending', 'dispatched', 'in_transit');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_due_deliveries_as_delivered()
to anon, authenticated;

create extension if not exists pg_cron with schema extensions;
select cron.unschedule(jobid)
from cron.job
where jobname = 'auto-mark-due-deliveries';

select cron.schedule(
  'auto-mark-due-deliveries',
  '*/10 * * * *',
  $$select public.mark_due_deliveries_as_delivered();$$
);
