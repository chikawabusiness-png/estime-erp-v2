grant execute on function public.change_order_status_with_stock(uuid, text)
to anon, authenticated;

notify pgrst, 'reload schema';
