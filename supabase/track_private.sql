-- A 4-digit code is not a secret. Details are returned only to the phone that holds
-- the tracking token, or to the signed-in buyer. The token also picks the right order
-- when two orders share a code.
-- Run once in the Supabase SQL editor. Safe to run again.

create or replace function public.get_order_by_code(p_short_code text, p_token text default null) returns json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_order record;
  v_shop_name text;
  v_ip text := coalesce(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), 'unknown');
begin
  if not public.rate_hit('trk:' || v_ip, 40, 600) then
    raise exception 'Too many attempts. Please wait a few minutes.';
  end if;
  if p_token is not null and length(p_token) >= 8 then
    select * into v_order from public.orders
      where short_code = p_short_code and tracking_token = p_token
      order by created_at desc limit 1;
  elsif auth.uid() is not null then
    select * into v_order from public.orders
      where short_code = p_short_code and buyer_id = auth.uid()
      order by created_at desc limit 1;
  else
    return null;
  end if;
  if v_order is null then return null; end if;
  select name into v_shop_name from public.places where id = v_order.shop_id;
  return json_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'total_amount_kobo', v_order.total_amount_kobo,
    'guest_name', v_order.guest_name,
    'shop_name', v_shop_name,
    'delivery_code', v_order.delivery_code,
    'booking_time', v_order.booking_time,
    'created_at', v_order.created_at
  );
end $$;

revoke all on function public.get_order_by_code(text, text) from public;
grant execute on function public.get_order_by_code(text, text) to anon, authenticated;
