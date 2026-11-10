-- Remembers the previous truth when a place changes.
-- Run once in the Supabase SQL editor after lives.sql. Safe to run again.

alter table public.lives add column if not exists prior_note text not null default '';
alter table public.lives add column if not exists prior_at timestamptz;

alter table public.lives drop constraint if exists lives_prior_note_len;
alter table public.lives add constraint lives_prior_note_len check (char_length(prior_note) <= 180);

create or replace function public.lives_touch() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.note is distinct from old.note then
    new.prior_note := left(coalesce(old.note, ''), 180);
    new.prior_at := old.updated_at;
  elsif tg_op = 'UPDATE' then
    new.prior_note := old.prior_note;
    new.prior_at := old.prior_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lives_touch on public.lives;
create trigger lives_touch before insert or update on public.lives
for each row execute function public.lives_touch();

revoke all on function public.lives_touch() from public, anon, authenticated;
