-- Security hardening: the app only calls these RPCs from logged-in sessions.
-- Earlier migrations granted EXECUTE to `anon`, which let anyone holding the
-- public anon key change stock or order statuses without authenticating.
revoke execute on all functions in schema public from public, anon;

-- Keep everything working for signed-in users and server-side jobs.
grant execute on all functions in schema public to authenticated, service_role;

-- RLS policies call is_admin(); it only returns false for anonymous callers.
grant execute on function public.is_admin() to anon;

-- Future functions in `public` are not callable by anon unless granted explicitly.
alter default privileges in schema public revoke execute on functions from anon;

notify pgrst, 'reload schema';
