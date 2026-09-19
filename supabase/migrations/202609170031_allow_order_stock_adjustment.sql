grant execute on function public.adjust_stock(uuid, integer, text)
to anon, authenticated;

notify pgrst, 'reload schema';
