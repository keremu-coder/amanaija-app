-- Message requests, blocks, reports and appointment booking
create table if not exists public.dm_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null default auth.uid(),
  to_id uuid not null,
  from_name text not null check (char_length(from_name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 200 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d'),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  unique (from_id, to_id)
);
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dm_requests(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 300 and body !~ '\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d'),
  created_at timestamptz not null default now()
);
create table if not exists public.user_blocks (
  user_id uuid not null default auth.uid(),
  blocked_id uuid not null,
  primary key (user_id, blocked_id)
);
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  target_id uuid not null,
  context text check (context is null or char_length(context) <= 300),
  created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  customer_name text not null check (char_length(customer_name) between 1 and 40),
  service text check (service is null or char_length(service) <= 80),
  slot timestamptz not null,
  status text not null default 'requested' check (status in ('requested','confirmed','declined','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists dm_req_to on public.dm_requests (to_id, status);
create index if not exists dm_msg_req on public.dm_messages (request_id, created_at);
create index if not exists bookings_shop on public.bookings (shop_id, slot);

alter table public.dm_requests enable row level security;
alter table public.dm_messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "dmreq read" on public.dm_requests;
drop policy if exists "dmreq insert" on public.dm_requests;
drop policy if exists "dmreq answer" on public.dm_requests;
create policy "dmreq read" on public.dm_requests for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "dmreq insert" on public.dm_requests for insert to authenticated with check (
  from_id = auth.uid() and not exists (select 1 from public.user_blocks b where b.user_id = to_id and b.blocked_id = auth.uid())
);
create policy "dmreq answer" on public.dm_requests for update to authenticated using (to_id = auth.uid()) with check (to_id = auth.uid());

drop policy if exists "dmmsg read" on public.dm_messages;
drop policy if exists "dmmsg insert" on public.dm_messages;
create policy "dmmsg read" on public.dm_messages for select to authenticated using (
  exists (select 1 from public.dm_requests r where r.id = request_id and auth.uid() in (r.from_id, r.to_id))
);
create policy "dmmsg insert" on public.dm_messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.dm_requests r where r.id = request_id and r.status = 'accepted' and auth.uid() in (r.from_id, r.to_id)
      and not exists (select 1 from public.user_blocks b where (b.user_id = r.from_id and b.blocked_id = r.to_id) or (b.user_id = r.to_id and b.blocked_id = r.from_id))
  )
);

drop policy if exists "user_blocks own" on public.user_blocks;
create policy "user_blocks own" on public.user_blocks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_reports insert" on public.user_reports;
create policy "user_reports insert" on public.user_reports for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "bookings read" on public.bookings;
drop policy if exists "bookings insert" on public.bookings;
drop policy if exists "bookings update" on public.bookings;
create policy "bookings read" on public.bookings for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.places p where p.id = shop_id and p.claimed_by = auth.uid())
);
create policy "bookings insert" on public.bookings for insert to authenticated with check (user_id = auth.uid());
create policy "bookings update" on public.bookings for update to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.places p where p.id = shop_id and p.claimed_by = auth.uid())
);

revoke all on public.dm_requests, public.dm_messages, public.user_blocks, public.user_reports, public.bookings from anon, authenticated;
grant select, insert on public.dm_requests to authenticated;
grant update (status) on public.dm_requests to authenticated;
grant select, insert on public.dm_messages to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant insert on public.user_reports to authenticated;
grant select, insert on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;
grant all on public.dm_requests, public.dm_messages, public.user_blocks, public.user_reports, public.bookings to service_role;

create or replace function public.dm_guard() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.dm_requests where from_id = new.from_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests. Please wait a little.';
  end if;
  return new;
end $$;
drop trigger if exists dm_guard on public.dm_requests;
create trigger dm_guard before insert on public.dm_requests for each row execute function public.dm_guard();
