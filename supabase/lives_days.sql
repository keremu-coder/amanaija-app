-- Keeps the last seven truths for a place. The caller cannot invent the history.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table public.lives add column if not exists memory jsonb not null default '[]'::jsonb;

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
