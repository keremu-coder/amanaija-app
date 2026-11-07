-- Pass it on: secondhand listings with anonymous sellers and fraud checks. Safe to run more than once.

create or replace function public.anon_handle(u uuid, prefix text) returns text
language sql immutable set search_path = public as $$
  select prefix || ' ' || lpad(((('x' || substr(md5(u::text), 1, 6))::bit(24)::int) % 10000)::text, 4, '0')
$$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  seller_handle text not null,
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) <= 1200),
  category text not null,
  condition text not null check (condition in ('new','open_box','like_new','used_good','used_fair')),
  price_ngn integer not null check (price_ngn between 100 and 50000000),
  city text not null check (char_length(city) between 2 and 40),
  lat double precision,
  lng double precision,
  photos text[] not null check (array_length(photos, 1) between 2 and 8),
  proof_photo text not null,
  proof_code text not null,
  status text not null default 'active' check (status in ('active','reserved','sold','removed')),
  private_sale boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);
create index if not exists listings_status on public.listings (status, created_at desc);
create index if not exists listings_seller on public.listings (seller_id);

create table if not exists public.listing_photo_hashes (
  hash text primary key,
  seller_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;
alter table public.listing_photo_hashes enable row level security;

drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings for select to anon, authenticated
using (status in ('active','reserved','sold') and expires_at > now());

-- The seller's real account is never readable by the public: seller_id is not in the column grants.
revoke all on public.listings from anon, authenticated;
grant select (id, seller_handle, slug, title, description, category, condition, price_ngn, city, photos, proof_photo, proof_code, status, private_sale, created_at, expires_at)
  on public.listings to anon, authenticated;
revoke all on public.listing_photo_hashes from anon, authenticated;
grant all on public.listings, public.listing_photo_hashes to service_role;

insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true) on conflict (id) do nothing;

-- Seller's own listings (includes private ones).
create or replace function public.my_listings() returns json
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select id, slug, title, price_ngn, status, private_sale, created_at, expires_at, photos[1] as cover
    from public.listings where seller_id = auth.uid()
  ) x
$$;

create or replace function public.set_listing_status(p_id uuid, p_status text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare cur text;
begin
  if p_status not in ('active','reserved','sold','removed') then raise exception 'bad status'; end if;
  select status into cur from public.listings where id = p_id and seller_id = auth.uid();
  if cur is null then raise exception 'not found'; end if;
  if cur = 'removed' then raise exception 'This listing was removed and needs a review'; end if;
  update public.listings set status = p_status where id = p_id;
  return p_status;
end $$;

-- Buyer asks the seller. Goes through the existing message-request system; the buyer only appears as "Buyer 1234".
create or replace function public.contact_listing(p_slug text, p_message text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.listings; msg text; rid uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into l from public.listings where slug = p_slug and status = 'active' and expires_at > now();
  if not found then raise exception 'This item is no longer available'; end if;
  if l.seller_id = auth.uid() then raise exception 'This is your own listing'; end if;
  if exists (select 1 from public.user_blocks b where b.user_id = l.seller_id and b.blocked_id = auth.uid()) then return 'sent'; end if;
  msg := left('About "' || l.title || '": ' || trim(p_message), 200);
  begin
    insert into public.dm_requests (from_id, to_id, from_name, body) values (auth.uid(), l.seller_id, public.anon_handle(auth.uid(), 'Buyer'), msg);
    return 'sent';
  exception
    when unique_violation then
      select id into rid from public.dm_requests where from_id = auth.uid() and to_id = l.seller_id;
      if exists (select 1 from public.dm_requests where id = rid and status = 'accepted') then
        insert into public.dm_messages (request_id, sender_id, body) values (rid, auth.uid(), left(msg, 300));
        return 'sent';
      end if;
      return 'pending';
    when check_violation then
      raise exception 'Please do not include phone or account numbers';
  end;
end $$;

-- Report a listing. Three different reporters automatically take it down until a person reviews it.
create or replace function public.report_listing(p_slug text, p_reason text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.listings; n int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into l from public.listings where slug = p_slug;
  if not found then raise exception 'not found'; end if;
  insert into public.user_reports (reporter_id, target_id, context) values (auth.uid(), l.seller_id, left('listing:' || p_slug || ' ' || coalesce(p_reason, ''), 300));
  select count(distinct reporter_id) into n from public.user_reports where context like 'listing:' || p_slug || '%';
  if n >= 3 then update public.listings set status = 'removed' where id = l.id and status <> 'sold'; end if;
  return 'ok';
end $$;

create or replace function public.admin_remove_listing(p_slug text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.listings set status = 'removed' where slug = p_slug;
  return 'ok';
end $$;

revoke all on function public.my_listings() from public, anon;
revoke all on function public.set_listing_status(uuid, text) from public, anon;
revoke all on function public.contact_listing(text, text) from public, anon;
revoke all on function public.report_listing(text, text) from public, anon;
revoke all on function public.admin_remove_listing(text) from public, anon;
grant execute on function public.my_listings() to authenticated;
grant execute on function public.set_listing_status(uuid, text) to authenticated;
grant execute on function public.contact_listing(text, text) to authenticated;
grant execute on function public.report_listing(text, text) to authenticated;
grant execute on function public.admin_remove_listing(text) to authenticated;
grant execute on function public.anon_handle(uuid, text) to service_role;

-- Round 2: live-camera checks and near-duplicate photo detection
alter table public.listing_photo_hashes add column if not exists phash text;
alter table public.listing_photo_hashes add column if not exists live boolean not null default false;
alter table public.listing_photo_hashes add column if not exists lat double precision;
alter table public.listing_photo_hashes add column if not exists lng double precision;
alter table public.listings add column if not exists verified boolean not null default false;
grant select (verified) on public.listings to anon, authenticated;

-- Round 3: audit fixes. Random photo names, truly private sales, honest report counting.
alter table public.listing_photo_hashes add column if not exists path text;

drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings for select to anon, authenticated
using (status in ('active','reserved','sold') and not private_sale and expires_at > now());

-- Private listings can only be opened by someone who knows the exact link.
create or replace function public.get_listing(p_slug text) returns json
language sql security definer set search_path = public, pg_temp as $$
  select row_to_json(x) from (
    select id, seller_handle, slug, title, description, category, condition, price_ngn, city, photos, proof_photo, proof_code, status, private_sale, verified, created_at
    from public.listings where slug = p_slug and status in ('active','reserved','sold') and expires_at > now()
  ) x
$$;
revoke all on function public.get_listing(text) from public;
grant execute on function public.get_listing(text) to anon, authenticated;

-- Only accounts older than 7 days count towards the automatic takedown, so new fake accounts cannot remove a listing.
create or replace function public.report_listing(p_slug text, p_reason text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare l public.listings; n int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into l from public.listings where slug = p_slug;
  if not found then raise exception 'not found'; end if;
  if (select count(*) from public.user_reports where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then raise exception 'Too many reports. Please wait a little.'; end if;
  insert into public.user_reports (reporter_id, target_id, context) values (auth.uid(), l.seller_id, left('listing:' || p_slug || ' ' || coalesce(p_reason, ''), 300));
  select count(distinct r.reporter_id) into n from public.user_reports r join auth.users u on u.id = r.reporter_id
    where r.context like 'listing:' || p_slug || '%' and u.created_at < now() - interval '7 days';
  if n >= 3 then update public.listings set status = 'removed' where id = l.id and status <> 'sold'; end if;
  return 'ok';
end $$;

-- Round 4: clear listings made before random photo names (only test listings exist), and an admin restore. Old photo files are removed from the Storage page, not here.
delete from public.listings where exists (select 1 from unnest(photos) p where p like '%/%') or proof_photo like '%/%';
delete from public.listing_photo_hashes where path is null;

create or replace function public.admin_restore_listing(p_slug text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.listings set status = 'active' where slug = p_slug and status = 'removed';
  delete from public.user_reports where context like 'listing:' || p_slug || '%';
  return 'ok';
end $$;
revoke all on function public.admin_restore_listing(text) from public, anon;
grant execute on function public.admin_restore_listing(text) to authenticated;
