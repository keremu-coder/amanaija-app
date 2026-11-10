-- Tie a guest checkout to the person who received the SMS.
-- Run this once in the Supabase SQL editor. Safe to run again.

alter table public.verified_phones add column if not exists proof_hash text;

drop function if exists public.create_order(uuid, jsonb, text, text, uuid, boolean, text, text, text, timestamptz);

create or replace function public.create_order(p_shop_id uuid, p_items jsonb, p_guest_name text, p_guest_phone text, p_buyer_id uuid,
  p_phone_verified boolean, p_encrypted_address text, p_address_iv text, p_address_auth_tag text, p_booking_time timestamptz default null,
  p_phone_proof text default null)
returns json language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := public.normalize_phone(p_guest_phone);
  v_order_id uuid := gen_random_uuid();
  v_tracking_token text := encode(gen_random_bytes(12), 'hex');
  v_short_code text; v_delivery_code text;
  v_total_kobo bigint := 0; v_fee_percent numeric; v_fee_amount bigint;
  v_item jsonb; v_item_id uuid; v_item_price bigint; v_item_qty integer; v_count integer;
begin
  if p_buyer_id is not null and p_buyer_id is distinct from v_uid then raise exception 'Invalid buyer'; end if;
  if v_uid is null then
    if v_phone is null or p_phone_proof is null or length(p_phone_proof) < 20 or not exists (
      select 1 from public.verified_phones
      where phone = v_phone
        and verified_at > now() - interval '30 minutes'
        and proof_hash = encode(extensions.digest(p_phone_proof, 'sha256'), 'hex')
    ) then
      raise exception 'Please verify your phone number first.';
    end if;
  end if;
  if not exists (select 1 from public.places where id = p_shop_id and status in ('claimed', 'verified')) then
    raise exception 'This shop is not accepting orders.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 30 then raise exception 'Invalid number of items'; end if;
  v_short_code := (1000 + (abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000))::text;
  v_delivery_code := (1000 + (abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000))::text;
  select fee_percent into v_fee_percent from public.platform_settings where id = 1;
  v_fee_percent := coalesce(v_fee_percent, 0);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_qty := (v_item->>'quantity')::integer;
    if v_item_qty is null or v_item_qty < 1 or v_item_qty > 50 then raise exception 'Invalid quantity'; end if;
    v_item_id := (v_item->>'item_id')::uuid;
    select price_kobo into v_item_price from public.items where id = v_item_id and shop_id = p_shop_id;
    if v_item_price is null or v_item_price <= 0 then raise exception 'Item not found'; end if;
    v_total_kobo := v_total_kobo + (v_item_price * v_item_qty);
  end loop;
  v_fee_amount := floor(v_total_kobo * (v_fee_percent / 100));
  insert into public.orders (id, shop_id, total_amount_kobo, status, guest_name, guest_phone, buyer_id, guest_phone_verified,
    tracking_token, short_code, encrypted_address, address_iv, address_auth_tag, fee_percent_at_time, fee_amount_kobo, delivery_code, booking_time)
  values (v_order_id, p_shop_id, v_total_kobo, 'Awaiting Seller Confirmation', left(p_guest_name, 80), p_guest_phone, v_uid, true,
    v_tracking_token, v_short_code, p_encrypted_address, p_address_iv, p_address_auth_tag, v_fee_percent, v_fee_amount, v_delivery_code, p_booking_time);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_qty := (v_item->>'quantity')::integer;
    v_item_id := (v_item->>'item_id')::uuid;
    select price_kobo into v_item_price from public.items where id = v_item_id and shop_id = p_shop_id;
    insert into public.order_items (order_id, item_id, quantity, price_at_time_kobo) values (v_order_id, v_item_id, v_item_qty, v_item_price);
  end loop;
  return json_build_object('order_id', v_order_id, 'tracking_token', v_tracking_token, 'short_code', v_short_code, 'delivery_code', v_delivery_code);
end;
$$;

revoke all on function public.create_order(uuid, jsonb, text, text, uuid, boolean, text, text, text, timestamptz, text) from public;
grant execute on function public.create_order(uuid, jsonb, text, text, uuid, boolean, text, text, text, timestamptz, text) to anon, authenticated, service_role;
