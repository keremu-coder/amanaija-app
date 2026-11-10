-- AmaNaija base schema, exported from the live database (Supabase project tnlrdxcgyzfcuhxdosfs).
-- Run this FIRST on a fresh Supabase project, then the other files in this folder:
--   security_hardening.sql, security_hardening_2.sql, security_hardening_3.sql,
--   marketplace.sql, hawkers.sql, needs_nearby.sql, supabase_boosts.sql,
--   supabase_dm_booking.sql, push.sql, app_errors.sql
-- Storage buckets to create by hand: shop-photos (public), listing-photos (public),
--   packing-videos (public), chat-media (PRIVATE).
-- Safe to re-run: tables use IF NOT EXISTS; policies and triggers are dropped first.

create extension if not exists pgcrypto with schema extensions;

---------------------------------------------------------------- tables
create table if not exists public.admin_audit_log (
  id uuid not null default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_id text not null,
  details jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create table if not exists public.api_hits (
  key text not null,
  at timestamptz not null default now()
);
create table if not exists public.area_messages (
  id uuid not null default gen_random_uuid(),
  area text not null,
  user_id uuid not null default auth.uid(),
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.banned_ips (
  id uuid not null default gen_random_uuid(),
  ip_hash text not null,
  reason text,
  created_at timestamptz default now()
);
create table if not exists public.blocks (
  id uuid not null default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create table if not exists public.bookings (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  user_id uuid not null default auth.uid(),
  customer_name text not null,
  service text,
  slot timestamptz not null,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
create table if not exists public.boosts (
  id uuid not null default gen_random_uuid(),
  place_id uuid not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.dm_messages (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  sender_id uuid not null default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.dm_requests (
  id uuid not null default gen_random_uuid(),
  from_id uuid not null default auth.uid(),
  to_id uuid not null,
  from_name text not null,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table if not exists public.hawkers (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  items text not null,
  lat double precision not null,
  lng double precision not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.places (
  id uuid not null default gen_random_uuid(),
  name text not null,
  category text not null,
  lat double precision not null,
  lng double precision not null,
  source text default 'community',
  status text default 'unclaimed',
  created_at timestamptz not null default timezone('utc'::text, now()),
  claimed_by uuid,
  live_photo_url text,
  upload_lat double precision,
  upload_lng double precision,
  parent_id uuid,
  signboard_name text,
  handle text,
  trust_level integer not null default 1,
  for_rent boolean not null default false,
  phone text,
  open_time text,
  close_time text
);
create table if not exists public.items (
  id uuid not null default gen_random_uuid(),
  shop_id uuid not null,
  name text not null,
  price_kobo bigint not null,
  photo_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  is_service boolean default false,
  service_duration_mins integer
);
create table if not exists public.listing_photo_hashes (
  hash text not null,
  seller_id uuid not null,
  created_at timestamptz not null default now(),
  phash text,
  live boolean not null default false,
  lat double precision,
  lng double precision,
  path text
);
create table if not exists public.listings (
  id uuid not null default gen_random_uuid(),
  seller_id uuid not null,
  seller_handle text not null,
  slug text not null,
  title text not null,
  description text not null,
  category text not null,
  condition text not null,
  price_ngn integer not null,
  city text not null,
  lat double precision,
  lng double precision,
  photos text[] not null,
  proof_photo text not null,
  proof_code text not null,
  status text not null default 'active',
  private_sale boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days'),
  verified boolean not null default false
);
create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  room_id text not null,
  user_name text not null,
  body text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  parent_id uuid,
  client_id text,
  media_url text,
  media_type text
);
create table if not exists public.message_reactions (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_name text not null,
  emoji text not null
);
create table if not exists public.needs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  body text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '04:00:00')
);
create table if not exists public.need_replies (
  id uuid not null default gen_random_uuid(),
  need_id uuid not null,
  shop_id uuid not null,
  user_id uuid not null default auth.uid(),
  answer text not null,
  price_text text,
  created_at timestamptz not null default now()
);
create table if not exists public.nigerian_places (
  id uuid not null default gen_random_uuid(),
  name text not null,
  type text not null,
  state text not null,
  lat double precision,
  lng double precision,
  created_at timestamptz default now(),
  status text default 'approved'
);
create table if not exists public.orders (
  id uuid not null default gen_random_uuid(),
  buyer_id uuid,
  shop_id uuid not null,
  status text not null default 'Awaiting Seller Confirmation',
  total_amount_kobo bigint not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  guest_name text,
  guest_phone text,
  guest_phone_verified boolean default false,
  tracking_token text,
  short_code text,
  encrypted_address text,
  address_iv text,
  address_auth_tag text,
  fee_percent_at_time numeric default 2.0,
  fee_amount_kobo bigint default 0,
  delivery_code text,
  packing_video_url text,
  booking_time timestamptz,
  delivery_attempts integer not null default 0
);
create table if not exists public.order_items (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  item_id uuid not null,
  quantity integer not null,
  price_at_time_kobo bigint not null
);
create table if not exists public.otp_codes (
  id uuid not null default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  attempts integer not null default 0
);
create table if not exists public.platform_settings (
  id integer not null default 1,
  fee_percent numeric default 2.0,
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create table if not exists public.profiles (
  id uuid not null,
  email text not null,
  is_admin boolean default false,
  is_banned boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  seller_tier integer default 1,
  ip_hash text
);
create table if not exists public.push_subscriptions (
  endpoint text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create table if not exists public.rate_events (
  id uuid not null default gen_random_uuid(),
  key text not null,
  bucket text not null,
  created_at timestamptz default now()
);
create table if not exists public.reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid,
  reporter_name text not null,
  reported_name text not null,
  message_body text not null,
  reason text default 'Inappropriate',
  status text default 'pending',
  created_at timestamptz not null default timezone('utc'::text, now())
);
create table if not exists public.user_blocks (
  user_id uuid not null default auth.uid(),
  blocked_id uuid not null
);
create table if not exists public.user_reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  target_id uuid not null,
  context text,
  created_at timestamptz not null default now(),
  status text not null default 'open',
  reviewed_at timestamptz
);
create table if not exists public.verified_phones (
  phone text not null,
  verified_at timestamptz not null default now(),
  proof_hash text
);
-- public.app_errors is created by app_errors.sql

---------------------------------------------------------------- keys and checks
-- Each block is skipped if the constraint already exists, so the file can be re-run.
do $$
declare s text;
begin
  foreach s in array array[
    -- primary keys
    'alter table public.admin_audit_log add constraint admin_audit_log_pkey primary key (id)',
    'alter table public.area_messages add constraint area_messages_pkey primary key (id)',
    'alter table public.banned_ips add constraint banned_ips_pkey primary key (id)',
    'alter table public.blocks add constraint blocks_pkey primary key (id)',
    'alter table public.bookings add constraint bookings_pkey primary key (id)',
    'alter table public.boosts add constraint boosts_pkey primary key (id)',
    'alter table public.dm_messages add constraint dm_messages_pkey primary key (id)',
    'alter table public.dm_requests add constraint dm_requests_pkey primary key (id)',
    'alter table public.hawkers add constraint hawkers_pkey primary key (id)',
    'alter table public.items add constraint items_pkey primary key (id)',
    'alter table public.listing_photo_hashes add constraint listing_photo_hashes_pkey primary key (hash)',
    'alter table public.listings add constraint listings_pkey primary key (id)',
    'alter table public.message_reactions add constraint message_reactions_pkey primary key (id)',
    'alter table public.messages add constraint messages_pkey primary key (id)',
    'alter table public.need_replies add constraint need_replies_pkey primary key (id)',
    'alter table public.needs add constraint needs_pkey primary key (id)',
    'alter table public.nigerian_places add constraint nigerian_places_pkey primary key (id)',
    'alter table public.order_items add constraint order_items_pkey primary key (id)',
    'alter table public.orders add constraint orders_pkey primary key (id)',
    'alter table public.otp_codes add constraint otp_codes_pkey primary key (id)',
    'alter table public.places add constraint places_pkey primary key (id)',
    'alter table public.platform_settings add constraint platform_settings_pkey primary key (id)',
    'alter table public.profiles add constraint profiles_pkey primary key (id)',
    'alter table public.push_subscriptions add constraint push_subscriptions_pkey primary key (endpoint)',
    'alter table public.rate_events add constraint rate_events_pkey primary key (id)',
    'alter table public.reports add constraint reports_pkey primary key (id)',
    'alter table public.user_blocks add constraint user_blocks_pkey primary key (user_id, blocked_id)',
    'alter table public.user_reports add constraint user_reports_pkey primary key (id)',
    'alter table public.verified_phones add constraint verified_phones_pkey primary key (phone)',
    -- unique
    'alter table public.banned_ips add constraint banned_ips_ip_hash_key unique (ip_hash)',
    'alter table public.blocks add constraint blocks_blocker_id_blocked_name_key unique (blocker_id, blocked_name)',
    'alter table public.dm_requests add constraint dm_requests_from_id_to_id_key unique (from_id, to_id)',
    'alter table public.hawkers add constraint hawkers_user_id_key unique (user_id)',
    'alter table public.listings add constraint listings_slug_key unique (slug)',
    'alter table public.message_reactions add constraint message_reactions_message_id_user_name_emoji_key unique (message_id, user_name, emoji)',
    'alter table public.need_replies add constraint need_replies_need_id_shop_id_key unique (need_id, shop_id)',
    'alter table public.orders add constraint orders_short_code_key unique (short_code)',
    'alter table public.orders add constraint orders_tracking_token_key unique (tracking_token)',
    'alter table public.profiles add constraint profiles_email_key unique (email)',
    -- checks (no phone numbers allowed in chat-style text)
    $c$alter table public.area_messages add constraint area_messages_body_check check (char_length(body) between 1 and 300 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d')$c$,
    'alter table public.area_messages add constraint area_messages_name_check check (char_length(name) between 1 and 40)',
    'alter table public.bookings add constraint bookings_customer_name_check check (char_length(customer_name) between 1 and 40)',
    'alter table public.bookings add constraint bookings_service_check check (service is null or char_length(service) <= 80)',
    $c$alter table public.bookings add constraint bookings_status_check check (status = any (array['requested','confirmed','declined','cancelled']))$c$,
    $c$alter table public.dm_messages add constraint dm_messages_body_check check (char_length(body) between 1 and 300 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d')$c$,
    $c$alter table public.dm_requests add constraint dm_requests_body_check check (char_length(body) between 1 and 200 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d')$c$,
    'alter table public.dm_requests add constraint dm_requests_check check (from_id <> to_id)',
    'alter table public.dm_requests add constraint dm_requests_from_name_check check (char_length(from_name) between 1 and 40)',
    $c$alter table public.dm_requests add constraint dm_requests_status_check check (status = any (array['pending','accepted','declined']))$c$,
    'alter table public.hawkers add constraint hawkers_items_check check (char_length(items) between 2 and 80)',
    'alter table public.hawkers add constraint hawkers_name_check check (char_length(name) between 2 and 30)',
    'alter table public.listings add constraint listings_city_check check (char_length(city) between 2 and 40)',
    $c$alter table public.listings add constraint listings_condition_check check (condition = any (array['new','open_box','like_new','used_good','used_fair']))$c$,
    'alter table public.listings add constraint listings_description_check check (char_length(description) <= 1200)',
    'alter table public.listings add constraint listings_photos_check check (array_length(photos, 1) between 2 and 8)',
    'alter table public.listings add constraint listings_price_ngn_check check (price_ngn between 100 and 50000000)',
    $c$alter table public.listings add constraint listings_status_check check (status = any (array['active','reserved','sold','removed']))$c$,
    'alter table public.listings add constraint listings_title_check check (char_length(title) between 3 and 80)',
    $c$alter table public.need_replies add constraint need_replies_answer_check check (answer = any (array['have','can_get','no']))$c$,
    'alter table public.need_replies add constraint need_replies_price_text_check check (price_text is null or char_length(price_text) <= 30)',
    $c$alter table public.needs add constraint needs_body_check check (char_length(body) between 3 and 120 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d')$c$,
    $c$alter table public.places add constraint places_category_check check (category = any (array['Shop','Plaza','Church','Hospital','School','Office','Residential','Food','Market','Other']))$c$,
    $c$alter table public.places add constraint places_handle_format check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$')$c$,
    'alter table public.places add constraint places_rent_needs_id check (not for_rent or trust_level >= 2)',
    $c$alter table public.places add constraint places_source_check check (source = any (array['osm','owner','community']))$c$,
    $c$alter table public.places add constraint places_status_check check (status = any (array['unclaimed','claimed','verified','frozen']))$c$,
    'alter table public.user_reports add constraint user_reports_context_check check (context is null or char_length(context) <= 300)',
    -- foreign keys
    'alter table public.admin_audit_log add constraint admin_audit_log_admin_id_fkey foreign key (admin_id) references auth.users(id)',
    'alter table public.blocks add constraint blocks_blocker_id_fkey foreign key (blocker_id) references auth.users(id)',
    'alter table public.bookings add constraint bookings_shop_id_fkey foreign key (shop_id) references public.places(id) on delete cascade',
    'alter table public.boosts add constraint boosts_place_id_fkey foreign key (place_id) references public.places(id) on delete cascade',
    'alter table public.dm_messages add constraint dm_messages_request_id_fkey foreign key (request_id) references public.dm_requests(id) on delete cascade',
    'alter table public.items add constraint items_shop_id_fkey foreign key (shop_id) references public.places(id) on delete cascade',
    'alter table public.message_reactions add constraint message_reactions_message_id_fkey foreign key (message_id) references public.messages(id) on delete cascade',
    'alter table public.messages add constraint messages_parent_id_fkey foreign key (parent_id) references public.messages(id) on delete cascade',
    'alter table public.need_replies add constraint need_replies_need_id_fkey foreign key (need_id) references public.needs(id) on delete cascade',
    'alter table public.need_replies add constraint need_replies_shop_id_fkey foreign key (shop_id) references public.places(id) on delete cascade',
    'alter table public.order_items add constraint order_items_item_id_fkey foreign key (item_id) references public.items(id)',
    'alter table public.order_items add constraint order_items_order_id_fkey foreign key (order_id) references public.orders(id) on delete cascade',
    'alter table public.orders add constraint orders_buyer_id_fkey foreign key (buyer_id) references auth.users(id)',
    'alter table public.orders add constraint orders_shop_id_fkey foreign key (shop_id) references public.places(id)',
    'alter table public.places add constraint places_claimed_by_fkey foreign key (claimed_by) references auth.users(id)',
    'alter table public.places add constraint places_parent_id_fkey foreign key (parent_id) references public.places(id) on delete cascade',
    'alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade',
    'alter table public.reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references auth.users(id)'
  ] loop
    begin execute s; exception when duplicate_object or duplicate_table or invalid_table_definition then null; end;
  end loop;
end $$;

insert into public.platform_settings (id, fee_percent) values (1, 2.0) on conflict (id) do nothing;

---------------------------------------------------------------- indexes
create index if not exists api_hits_key_at on public.api_hits (key, at desc);
create index if not exists area_messages_area_time on public.area_messages (area, created_at desc);
create index if not exists bookings_shop on public.bookings (shop_id, slot);
create index if not exists boosts_active on public.boosts (ends_at);
create index if not exists dm_msg_req on public.dm_messages (request_id, created_at);
create index if not exists dm_req_to on public.dm_requests (to_id, status);
create index if not exists listings_seller on public.listings (seller_id);
create index if not exists listings_status on public.listings (status, created_at desc);
create index if not exists need_replies_need on public.need_replies (need_id);
create index if not exists needs_open_time on public.needs (status, created_at desc);
create index if not exists idx_np_name on public.nigerian_places (lower(name));
create index if not exists idx_np_state on public.nigerian_places (state);
create unique index if not exists uq_nigerian_places on public.nigerian_places (lower(name), type);
create unique index if not exists places_handle_unique on public.places (lower(handle)) where handle is not null;
create index if not exists push_subs_user on public.push_subscriptions (user_id);
create index if not exists idx_rate_created on public.rate_events (created_at);
create index if not exists idx_rate_key_bucket on public.rate_events (key, bucket, created_at);

---------------------------------------------------------------- row level security on everywhere
do $$
declare t text;
begin
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

---------------------------------------------------------------- functions the other SQL files do not define
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.dist_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path to 'public', 'extensions', 'pg_temp' as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.normalize_phone(p text) returns text
language sql immutable set search_path to 'public', 'extensions', 'pg_temp' as $$
  select case when n ~ '^234[0-9]{10}$' then n else null end
  from (
    select case
      when d like '0%' then '234' || substr(d, 2)
      when d like '234%' then d
      else '234' || d
    end as n
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s1
  ) s2;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create or replace function public.check_ip_ban(p_ip_hash text) returns boolean
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  return exists (select 1 from public.banned_ips where ip_hash = p_ip_hash);
end;
$$;

create or replace function public.area_rate_limit() returns trigger
language plpgsql set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  if exists (select 1 from public.area_messages where user_id = new.user_id and created_at > now() - interval '3 seconds') then
    raise exception 'Slow down a little';
  end if;
  return new;
end $$;

create or replace function public.check_chat_rate_limit() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare recent_count integer;
begin
  if new.client_id is null then return new; end if;
  select count(*) into recent_count from public.messages
   where client_id = new.client_id and room_id = new.room_id and created_at > now() - interval '60 seconds';
  if recent_count >= 15 then
    raise exception 'Rate limit exceeded: max 15 messages per minute';
  end if;
  return new;
end;
$$;

create or replace function public.check_item_price_limit() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare v_seller_tier integer; v_max_price bigint;
begin
  select p.seller_tier into v_seller_tier
    from public.places pl join public.profiles p on pl.claimed_by = p.id
   where pl.id = new.shop_id;
  if v_seller_tier is null then v_seller_tier := 1; end if;
  if v_seller_tier = 1 then v_max_price := 2000000;        -- N20,000 in kobo
  elsif v_seller_tier = 2 then v_max_price := 15000000;    -- N150,000
  else v_max_price := 99999999999; end if;
  if new.price_kobo > v_max_price then
    raise exception 'Price limit exceeded. New sellers can only list items up to N20,000. Complete more orders to increase your limit.';
  end if;
  return new;
end;
$$;

create or replace function public.needs_guard() returns trigger
language plpgsql set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  new.lat := round(new.lat::numeric, 2);
  new.lng := round(new.lng::numeric, 2);
  if (select count(*) from public.needs where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Please wait a little.';
  end if;
  return new;
end $$;

create or replace function public.protect_admin_columns() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  if not (select is_admin from public.profiles where id = auth.uid()) then
    if (old.is_admin is distinct from new.is_admin) or (old.is_banned is distinct from new.is_banned) then
      raise exception 'Security violation: You cannot modify admin or ban status.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_place_columns() returns trigger
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
begin
  if auth.uid() is null then return new; end if;  -- server / service role
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then return new; end if;
  if new.claimed_by is distinct from old.claimed_by
     and not (old.claimed_by is null and new.claimed_by = auth.uid()) then
    raise exception 'Not allowed to change the owner of a place';
  end if;
  if new.trust_level is distinct from old.trust_level then
    raise exception 'Not allowed to change the trust level';
  end if;
  return new;
end;
$$;

create or replace function public.claim_new_place(p_name text, p_category text, p_lat double precision, p_lng double precision,
  p_upload_lat double precision, p_upload_lng double precision, p_photo_url text)
returns public.places language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare uid uuid := auth.uid(); cat text; r public.places;
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) < 2 or char_length(p_name) > 80 then raise exception 'Shop name must be 2 to 80 characters.'; end if;
  if p_lat is null or p_lng is null or p_upload_lat is null or p_upload_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location.';
  end if;
  if public.dist_m(p_lat, p_lng, p_upload_lat, p_upload_lng) > 100 then raise exception 'You must be at the location to claim it.'; end if;
  if p_photo_url is null or p_photo_url not like '%/storage/v1/object/public/shop-photos/' || uid::text || '-%' then
    raise exception 'A live photo taken in the app is required.';
  end if;
  if exists (select 1 from public.places p where public.dist_m(p.lat, p.lng, p_lat, p_lng) < 50) then
    raise exception 'A place already exists within 50 meters. If it is yours, claim the existing pin.';
  end if;
  if (select count(*) from public.places where claimed_by = uid) >= 5 then raise exception 'You have reached the limit of 5 claimed places for now.'; end if;
  cat := coalesce(p_category, 'Shop');
  if cat not in ('Shop','Food','Service','Plaza','Church','Hospital','School','Office','Residential','Market','Other') then cat := 'Shop'; end if;
  insert into public.places (name, category, lat, lng, source, status, claimed_by, live_photo_url, upload_lat, upload_lng)
  values (p_name, cat, p_lat, p_lng, 'owner', 'claimed', uid, p_photo_url, p_upload_lat, p_upload_lng)
  returning * into r;
  return r;
end;
$$;

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

-- orders_guard also lives in security_hardening.sql; this is the current version.
create or replace function public.orders_guard() returns trigger
language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  if auth.role() in ('anon','authenticated') and coalesce(current_setting('app.bypass', true), '') <> '1' then
    if new.status is distinct from old.status and new.status in ('Payment Verified','Completed') then
      raise exception 'This status can only be set by the payment or delivery system';
    end if;
    if new.total_amount_kobo is distinct from old.total_amount_kobo
       or new.fee_amount_kobo is distinct from old.fee_amount_kobo
       or new.fee_percent_at_time is distinct from old.fee_percent_at_time
       or new.buyer_id is distinct from old.buyer_id
       or new.shop_id is distinct from old.shop_id then
      raise exception 'Order amounts and owners cannot be changed';
    end if;
  end if;
  return new;
end $$;

---------------------------------------------------------------- triggers
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
drop trigger if exists area_rate_limit on public.area_messages;
create trigger area_rate_limit before insert on public.area_messages for each row execute function public.area_rate_limit();
drop trigger if exists enforce_tier_price_limit on public.items;
create trigger enforce_tier_price_limit before insert on public.items for each row execute function public.check_item_price_limit();
drop trigger if exists enforce_chat_rate_limit on public.messages;
create trigger enforce_chat_rate_limit before insert on public.messages for each row execute function public.check_chat_rate_limit();
drop trigger if exists needs_guard on public.needs;
create trigger needs_guard before insert on public.needs for each row execute function public.needs_guard();
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before update on public.orders for each row execute function public.orders_guard();
drop trigger if exists protect_place_columns_trg on public.places;
create trigger protect_place_columns_trg before update on public.places for each row execute function public.protect_place_columns();
drop trigger if exists enforce_admin_protection on public.profiles;
create trigger enforce_admin_protection before update on public.profiles for each row execute function public.protect_admin_columns();
-- bookings_guard_trg and dm_guard are created by security_hardening_3.sql and supabase_dm_booking.sql.

---------------------------------------------------------------- row level security policies
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Admins can view audit logs" on public.admin_audit_log for select using (public.is_admin());
create policy "Admins insert audit logs" on public.admin_audit_log for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());
create policy "area delete own" on public.area_messages for delete to authenticated using (user_id = auth.uid());
create policy "area insert own" on public.area_messages for insert to authenticated with check (user_id = auth.uid());
create policy "area read" on public.area_messages for select to authenticated using (true);
create policy "Users can delete their own blocks" on public.blocks for delete to authenticated using (auth.uid() = blocker_id);
create policy "Users can insert their own blocks" on public.blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "Users can view their own blocks" on public.blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "bookings insert" on public.bookings for insert to authenticated with check (user_id = auth.uid());
create policy "bookings read" on public.bookings for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.places p where p.id = bookings.shop_id and p.claimed_by = auth.uid()));
create policy "bookings update" on public.bookings for update to authenticated using (user_id = auth.uid() or exists (select 1 from public.places p where p.id = bookings.shop_id and p.claimed_by = auth.uid()));
create policy "boosts public read" on public.boosts for select to anon, authenticated using (ends_at > now());
create policy "dmmsg insert" on public.dm_messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.dm_requests r
     where r.id = dm_messages.request_id and r.status = 'accepted'
       and (auth.uid() = r.from_id or auth.uid() = r.to_id)
       and not exists (select 1 from public.user_blocks b
                        where (b.user_id = r.from_id and b.blocked_id = r.to_id) or (b.user_id = r.to_id and b.blocked_id = r.from_id))));
create policy "dmmsg read" on public.dm_messages for select to authenticated using (exists (select 1 from public.dm_requests r where r.id = dm_messages.request_id and (auth.uid() = r.from_id or auth.uid() = r.to_id)));
create policy "dmreq answer" on public.dm_requests for update to authenticated using (to_id = auth.uid()) with check (to_id = auth.uid());
create policy "dmreq insert" on public.dm_requests for insert to authenticated with check (from_id = auth.uid() and not exists (select 1 from public.user_blocks b where b.user_id = dm_requests.to_id and b.blocked_id = auth.uid()));
create policy "dmreq read" on public.dm_requests for select to authenticated using (auth.uid() = from_id or auth.uid() = to_id);
create policy "Items are viewable by everyone." on public.items for select using (true);
create policy "Owners can insert items." on public.items for insert to authenticated with check (exists (select 1 from public.places where places.id = items.shop_id and places.claimed_by = auth.uid()));
create policy "listings public read" on public.listings for select to anon, authenticated using (status = any (array['active','reserved','sold']) and not private_sale and expires_at > now());
create policy "Anyone can delete reactions" on public.message_reactions for delete using (true);
create policy "Anyone can insert reactions" on public.message_reactions for insert with check (true);
create policy "Anyone can view reactions" on public.message_reactions for select using (true);
create policy "Allow server inserts" on public.messages for insert to service_role with check (true);
create policy "Anyone can read messages" on public.messages for select using (true);
create policy "replies insert shop owner" on public.need_replies for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.places p where p.id = need_replies.shop_id and p.claimed_by = auth.uid()));
create policy "replies read" on public.need_replies for select to authenticated using (true);
create policy "needs insert own" on public.needs for insert to authenticated with check (user_id = auth.uid());
create policy "needs read" on public.needs for select to authenticated using (user_id = auth.uid());
create policy "needs update own" on public.needs for update to authenticated using (user_id = auth.uid());
create policy "Admins can delete places" on public.nigerian_places for delete to authenticated using (public.is_admin());
create policy "Admins can update places" on public.nigerian_places for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Anyone can insert pending places" on public.nigerian_places for insert with check (status = 'pending');
create policy "Anyone can read nigerian places" on public.nigerian_places for select using (true);
create policy "Users can view order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders where orders.id = order_items.order_id));
create policy "Sellers can update their shop orders" on public.orders for update to authenticated using (auth.uid() in (select places.claimed_by from public.places where places.id = orders.shop_id));
create policy "Users can view their own orders" on public.orders for select to authenticated using (auth.uid() = buyer_id or auth.uid() in (select places.claimed_by from public.places where places.id = orders.shop_id));
create policy "Admins can update all places" on public.places for update using (public.is_admin());
create policy "Owners can update own places" on public.places for update to authenticated using (claimed_by = auth.uid()) with check (claimed_by = auth.uid());
create policy "Places are viewable by everyone." on public.places for select using (true);
create policy "Admins can update settings" on public.platform_settings for update using (public.is_admin());
create policy "Anyone can read settings" on public.platform_settings for select using (true);
create policy "Admins can ban users" on public.profiles for update using (public.is_admin());
create policy "Admins can view all profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Admins can read all reports" on public.reports for select using (public.is_admin());
create policy "Admins can update reports" on public.reports for update using (public.is_admin());
create policy "Anyone can submit a report" on public.reports for insert with check (true);
create policy "user_blocks own" on public.user_blocks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_reports admin read" on public.user_reports for select to authenticated using (public.is_admin());
create policy "user_reports admin update" on public.user_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "user_reports insert" on public.user_reports for insert to authenticated with check (reporter_id = auth.uid());
-- Tables with RLS on and no policy (api_hits, banned_ips, hawkers, listing_photo_hashes, otp_codes,
-- push_subscriptions, rate_events, verified_phones) are reachable only by the server's service key.
