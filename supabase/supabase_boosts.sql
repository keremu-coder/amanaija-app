-- Paid "Promoted" slots for shops. Only the service role (you, in the SQL Editor) can write.
create table if not exists public.boosts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists boosts_active on public.boosts (ends_at);
alter table public.boosts enable row level security;
drop policy if exists "boosts public read" on public.boosts;
create policy "boosts public read" on public.boosts for select to anon, authenticated using (ends_at > now());
revoke all on public.boosts from anon, authenticated;
grant select on public.boosts to anon, authenticated;
grant all on public.boosts to service_role;
