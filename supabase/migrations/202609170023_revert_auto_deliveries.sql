select cron.unschedule(jobid)
from cron.job
where jobname = 'auto-mark-due-deliveries';

drop function if exists public.mark_due_deliveries_as_delivered();
