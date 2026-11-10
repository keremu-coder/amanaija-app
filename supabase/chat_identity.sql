-- A lounge message belongs to the signed-in person, not to a name they typed.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table public.messages add column if not exists user_id uuid;
alter table public.message_reactions add column if not exists user_id uuid;
alter table public.blocks add column if not exists blocked_user_id uuid;

drop policy if exists "Anyone can insert reactions" on public.message_reactions;
drop policy if exists "reactions insert own" on public.message_reactions;
create policy "reactions insert own" on public.message_reactions
  for insert to authenticated
  with check (user_id = auth.uid());
revoke insert on public.message_reactions from anon;
