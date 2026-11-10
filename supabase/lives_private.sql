-- A home is private. Neighbours see it at the saved place.
-- Ghost mode hides it. A hello works only while the person is outside and has asked for one.
-- Run once in the Supabase SQL editor. Safe to run again.

drop policy if exists "lives read" on public.lives;
drop policy if exists "lives read own" on public.lives;
create policy "lives read own" on public.lives
  for select to authenticated
  using (user_id = auth.uid());

revoke select on public.lives from anon;

create table if not exists public.life_out (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_out boolean not null default false
);

alter table public.life_out add column if not exists is_ghost boolean not null default false;
alter table public.life_out add column if not exists hello boolean not null default false;

alter table public.life_out enable row level security;

drop policy if exists "life_out write own" on public.life_out;
create policy "life_out write own" on public.life_out
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.life_out from public, anon;
grant select, insert, update on public.life_out to authenticated;

drop function if exists public.lives_nearby(double precision, double precision);

create or replace function public.lives_nearby(p_lat double precision, p_lng double precision)
returns table (
  user_id uuid,
  place_name text,
  lat double precision,
  lng double precision,
  updated_at timestamptz,
  is_out boolean,
  hello boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.user_id, l.place_name, l.lat, l.lng, l.updated_at,
         coalesce(o.is_out, false), coalesce(o.hello, false)
  from public.lives l
  left join public.life_out o on o.user_id = l.user_id
  where l.lat between p_lat - 0.03 and p_lat + 0.03
    and l.lng between p_lng - 0.03 and p_lng + 0.03
    and l.lat is not null
    and l.lng is not null
    and coalesce(o.is_ghost, false) = false
  limit 8;
$$;

revoke all on function public.lives_nearby(double precision, double precision) from public;
grant execute on function public.lives_nearby(double precision, double precision) to anon, authenticated;

create or replace function public.hello_neighbor(p_to uuid, p_name text, p_body text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  if p_to is null or p_to = auth.uid() then raise exception 'That is you'; end if;
  if exists (select 1 from public.user_blocks b where b.user_id = p_to and b.blocked_id = auth.uid()) then
    raise exception 'They are not open to hello';
  end if;
  if exists (select 1 from public.life_out o where o.user_id = p_to and (o.is_ghost or not o.hello)) then
    raise exception 'They are not open to hello';
  end if;
  if exists (
    select 1 from public.lives l
    join public.life_out o on o.user_id = l.user_id
    where l.user_id = p_to and not o.is_out
  ) then
    raise exception 'They are not open to hello';
  end if;
  insert into public.dm_requests (from_id, to_id, from_name, body)
  values (auth.uid(), p_to, public.anon_handle(auth.uid(), 'Neighbour'), left(trim(p_body), 200));
  return 'sent';
exception
  when unique_violation then raise exception 'You already sent this person a request.';
end $$;

revoke all on function public.hello_neighbor(uuid, text, text) from public;
grant execute on function public.hello_neighbor(uuid, text, text) to authenticated;

-- A direct insert cannot skip the hello switch. A shop or an active hawker can still be asked.
create or replace function public.dm_hello_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  shop boolean;
  hawking boolean;
begin
  select exists (
    select 1 from public.places p
    where p.claimed_by = new.to_id and p.status in ('claimed', 'verified')
  ) into shop;
  select exists (
    select 1 from public.hawkers h
    where h.user_id = new.to_id and h.active and h.updated_at > now() - interval '3 hours'
  ) into hawking;
  if shop or hawking then return new; end if;
  if not exists (
    select 1 from public.life_out o
    where o.user_id = new.to_id and o.hello and not o.is_ghost
  ) then
    raise exception 'They are not open to hello';
  end if;
  if exists (
    select 1 from public.lives l
    join public.life_out o on o.user_id = l.user_id
    where l.user_id = new.to_id and not o.is_out
  ) then
    raise exception 'They are not open to hello';
  end if;
  return new;
end $$;

drop trigger if exists dm_hello_guard on public.dm_requests;
create trigger dm_hello_guard before insert on public.dm_requests
  for each row execute function public.dm_hello_guard();
revoke all on function public.dm_hello_guard() from public, anon, authenticated;

-- The browser cannot choose the name on a request. The database writes it from the account.
create or replace function public.dm_name_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.from_id is not null then
    new.from_name := public.anon_handle(new.from_id, 'Neighbour');
  end if;
  return new;
end $$;

drop trigger if exists dm_name_guard on public.dm_requests;
create trigger dm_name_guard before insert on public.dm_requests
  for each row execute function public.dm_name_guard();
revoke all on function public.dm_name_guard() from public, anon, authenticated;

