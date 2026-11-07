-- Hawkers: people who sell while walking say "I'm hawking now" so buyers nearby can call them over.
-- Location is rounded to about 500 m, shown only while active, and disappears after 3 hours. Safe to run more than once.
create table if not exists public.hawkers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text not null check (char_length(name) between 2 and 30),
  items text not null check (char_length(items) between 2 and 80),
  lat double precision not null,
  lng double precision not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.hawkers enable row level security;
revoke all on public.hawkers from anon, authenticated;
grant all on public.hawkers to service_role;

create or replace function public.hawk_start(p_name text, p_items text, p_lat double precision, p_lng double precision) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if p_name ~ '\d{5,}' or p_items ~ '\d{5,}' then raise exception 'Please do not include phone numbers'; end if;
  insert into public.hawkers (user_id, name, items, lat, lng, active, updated_at)
  values (auth.uid(), trim(p_name), trim(p_items), round(p_lat::numeric, 3)::double precision, round(p_lng::numeric, 3)::double precision, true, now())
  on conflict (user_id) do update set name = excluded.name, items = excluded.items, lat = excluded.lat, lng = excluded.lng, active = true, updated_at = now();
  return 'ok';
end $$;

create or replace function public.hawk_stop() returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.hawkers set active = false where user_id = auth.uid();
  return 'ok';
end $$;

create or replace function public.hawk_me() returns json
language sql security definer set search_path = public, pg_temp as $$
  select row_to_json(x) from (select name, items, active and updated_at > now() - interval '3 hours' as active from public.hawkers where user_id = auth.uid()) x
$$;

-- Anyone, including guests, can see hawkers who are active near a point. No account ids are returned.
create or replace function public.hawkers_near(p_lat double precision, p_lng double precision) returns table (id uuid, name text, items text, lat double precision, lng double precision, minutes_ago int)
language sql security definer set search_path = public, pg_temp as $$
  select h.id, h.name, h.items, h.lat, h.lng, (extract(epoch from (now() - h.updated_at)) / 60)::int
  from public.hawkers h
  where h.active and h.updated_at > now() - interval '3 hours'
    and abs(h.lat - p_lat) < 0.05 and abs(h.lng - p_lng) < 0.05
  order by h.updated_at desc limit 50
$$;

-- "Please come over": goes through the normal consent-based message request, as "Buyer 1234".
create or replace function public.call_hawker(p_id uuid, p_note text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare h public.hawkers;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into h from public.hawkers where id = p_id and active and updated_at > now() - interval '3 hours';
  if not found then raise exception 'This hawker is no longer active'; end if;
  if h.user_id = auth.uid() then raise exception 'This is you'; end if;
  if exists (select 1 from public.user_blocks b where b.user_id = h.user_id and b.blocked_id = auth.uid()) then return 'sent'; end if;
  begin
    insert into public.dm_requests (from_id, to_id, from_name, body) values (auth.uid(), h.user_id, public.anon_handle(auth.uid(), 'Buyer'), left('Please come over: ' || trim(coalesce(p_note, 'I want to buy')), 200));
    return 'sent';
  exception
    when unique_violation then return 'pending';
    when check_violation then raise exception 'Please do not include phone or account numbers';
  end;
end $$;

revoke all on function public.hawk_start(text, text, double precision, double precision) from public, anon;
revoke all on function public.hawk_stop() from public, anon;
revoke all on function public.hawk_me() from public, anon;
revoke all on function public.call_hawker(uuid, text) from public, anon;
revoke all on function public.hawkers_near(double precision, double precision) from public;
grant execute on function public.hawk_start(text, text, double precision, double precision) to authenticated;
grant execute on function public.hawk_stop() to authenticated;
grant execute on function public.hawk_me() to authenticated;
grant execute on function public.call_hawker(uuid, text) to authenticated;
grant execute on function public.hawkers_near(double precision, double precision) to anon, authenticated;
