-- A person's place. It stays when they leave, with whatever was last true.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.lives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  place_name text not null check (char_length(btrim(place_name)) between 2 and 60),
  note text not null default '' check (char_length(note) <= 180),
  lat double precision check (lat is null or (lat >= -90 and lat <= 90)),
  lng double precision check (lng is null or (lng >= -180 and lng <= 180)),
  prior_note text not null default '' check (char_length(prior_note) <= 180),
  prior_at timestamptz,
  memory jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lives enable row level security;

drop policy if exists "lives read" on public.lives;
create policy "lives read" on public.lives for select to anon, authenticated using (true);

drop policy if exists "lives insert own" on public.lives;
create policy "lives insert own" on public.lives for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "lives update own" on public.lives;
create policy "lives update own" on public.lives for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.lives from public, anon;
grant select on public.lives to anon, authenticated;
grant insert, update on public.lives to authenticated;
grant all on public.lives to service_role;

create index if not exists lives_lat_lng on public.lives (lat, lng);

-- The clock is the database's. A caller cannot backdate or future-date a life.
create or replace function public.lives_touch() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_mem jsonb;
begin
  if tg_op = 'INSERT' then
    new.prior_note := '';
    new.prior_at := null;
    new.memory := '[]'::jsonb;
  elsif new.note is distinct from old.note then
    new.prior_note := left(coalesce(old.note, ''), 180);
    new.prior_at := old.updated_at;
    v_mem := jsonb_build_array(jsonb_build_object('note', left(coalesce(old.note, ''), 180), 'at', old.updated_at))
      || coalesce(old.memory, '[]'::jsonb);
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
      into new.memory
      from (
        select elem, ord
        from jsonb_array_elements(v_mem) with ordinality as t(elem, ord)
        order by ord
        limit 7
      ) s;
  else
    new.prior_note := old.prior_note;
    new.prior_at := old.prior_at;
    new.memory := coalesce(old.memory, '[]'::jsonb);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lives_touch on public.lives;
create trigger lives_touch before insert or update on public.lives
for each row execute function public.lives_touch();

revoke all on function public.lives_touch() from public, anon, authenticated;
