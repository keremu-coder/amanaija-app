-- AmaNaija security hardening, part 2 (safe to run more than once). Run AFTER security_hardening.sql

-- A. Durable rate limiter used by server routes and by order tracking
create table if not exists public.api_hits (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists api_hits_key_at on public.api_hits (key, at desc);
alter table public.api_hits enable row level security;
revoke all on public.api_hits from anon, authenticated;
grant all on public.api_hits to service_role;

create or replace function public.rate_hit(p_key text, p_limit int, p_window_sec int) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count int;
begin
  select count(*) into v_count from public.api_hits where key = p_key and at > now() - make_interval(secs => p_window_sec);
  if v_count >= p_limit then return false; end if;
  insert into public.api_hits (key) values (p_key);
  if random() < 0.02 then delete from public.api_hits where at < now() - interval '1 day'; end if;
  return true;
end $$;
revoke all on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

-- B. Delivery code stays secret from the seller; sellers prove delivery through a checked function
alter table public.orders add column if not exists delivery_attempts int not null default 0;

revoke select on public.orders from anon, authenticated;
grant select (id, buyer_id, shop_id, status, total_amount_kobo, created_at, guest_name, guest_phone, guest_phone_verified,
              short_code, encrypted_address, address_iv, address_auth_tag, fee_percent_at_time, fee_amount_kobo,
              packing_video_url, booking_time)
  on public.orders to authenticated;

create or replace function public.orders_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.role() in ('anon', 'authenticated')
     and coalesce(current_setting('app.bypass', true), '') <> '1'
     and new.status is distinct from old.status
     and new.status in ('Payment Verified', 'Completed') then
    raise exception 'This status can only be set by the payment or delivery system';
  end if;
  return new;
end $$;
revoke execute on function public.orders_guard() from public, anon, authenticated;

create or replace function public.complete_delivery(p_order_id uuid, p_code text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v orders%rowtype;
begin
  select * into v from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if not exists (select 1 from public.places where id = v.shop_id and claimed_by = auth.uid()) then
    raise exception 'This is not your order';
  end if;
  if v.status <> 'Out for Delivery' or v.booking_time is not null then
    raise exception 'This order is not out for delivery';
  end if;
  if v.delivery_attempts >= 5 then
    raise exception 'Too many wrong codes. Please contact support.';
  end if;
  if p_code is distinct from v.delivery_code then
    update public.orders set delivery_attempts = delivery_attempts + 1 where id = p_order_id;
    return json_build_object('ok', false, 'attempts_left', greatest(0, 4 - v.delivery_attempts));
  end if;
  perform set_config('app.bypass', '1', true);
  update public.orders set status = 'Completed' where id = p_order_id;
  return json_build_object('ok', true);
end $$;
revoke all on function public.complete_delivery(uuid, text) from public, anon;
grant execute on function public.complete_delivery(uuid, text) to authenticated;

create or replace function public.approve_booking(p_order_id uuid, p_token text default null) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare v orders%rowtype;
begin
  select * into v from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if not ((p_token is not null and p_token = v.tracking_token) or (auth.uid() is not null and auth.uid() = v.buyer_id)) then
    raise exception 'Not allowed';
  end if;
  if v.booking_time is null or v.status <> 'Out for Delivery' then
    raise exception 'This service is not waiting for approval';
  end if;
  perform set_config('app.bypass', '1', true);
  update public.orders set status = 'Completed' where id = p_order_id;
  return json_build_object('ok', true);
end $$;
revoke all on function public.approve_booking(uuid, text) from public;
grant execute on function public.approve_booking(uuid, text) to anon, authenticated;

-- C. Order tracking: limit guessing per visitor (40 tries per 10 minutes)
create or replace function public.get_order_by_code(p_short_code text, p_token text default null) returns json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_order record;
  v_shop_name text;
  v_private boolean;
  v_ip text := coalesce(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), 'unknown');
begin
  if not public.rate_hit('trk:' || v_ip, 40, 600) then
    raise exception 'Too many attempts. Please wait a few minutes.';
  end if;
  select * into v_order from public.orders where short_code = p_short_code order by created_at desc limit 1;
  if v_order is null then return null; end if;
  select name into v_shop_name from public.places where id = v_order.shop_id;
  v_private := (p_token is not null and p_token = v_order.tracking_token) or (auth.uid() is not null and auth.uid() = v_order.buyer_id);
  return json_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'total_amount_kobo', case when v_private then v_order.total_amount_kobo end,
    'guest_name', case when v_private then v_order.guest_name end,
    'shop_name', v_shop_name,
    'delivery_code', case when v_private then v_order.delivery_code end,
    'booking_time', v_order.booking_time,
    'created_at', v_order.created_at
  );
end $$;
grant execute on function public.get_order_by_code(text, text) to anon, authenticated;
