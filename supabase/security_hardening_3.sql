-- Booking rules, people-report review, and needs visibility. Safe to run more than once.

-- 1) Bookings: buyers can request or cancel; shop owners confirm or decline. Slot must be real and free.
create or replace function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  is_owner boolean;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'not allowed'; end if;
    new.status := 'requested';
    if new.slot < now() + interval '5 minutes' then raise exception 'Pick a time in the future'; end if;
    if new.slot > now() + interval '90 days' then raise exception 'That date is too far ahead'; end if;
    if exists (
      select 1 from public.bookings b
      where b.shop_id = new.shop_id and b.status in ('requested','confirmed')
        and b.slot >= new.slot - interval '29 minutes' and b.slot <= new.slot + interval '29 minutes'
    ) then raise exception 'That time is already taken'; end if;
    if (select count(*) from public.bookings b where b.user_id = auth.uid() and b.status in ('requested','confirmed') and b.slot > now()) >= 5 then
      raise exception 'Too many open bookings';
    end if;
    return new;
  end if;

  -- UPDATE: only the status may change
  if new.shop_id is distinct from old.shop_id or new.user_id is distinct from old.user_id or new.slot is distinct from old.slot then
    raise exception 'not allowed';
  end if;
  if new.status is distinct from old.status then
    select exists (select 1 from public.places p where p.id = old.shop_id and p.claimed_by = auth.uid()) into is_owner;
    if is_owner then
      if new.status not in ('confirmed','declined') then raise exception 'not allowed'; end if;
    elsif old.user_id = auth.uid() then
      if new.status <> 'cancelled' then raise exception 'Only the shop can confirm'; end if;
    else
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bookings_guard_trg on public.bookings;
create trigger bookings_guard_trg before insert or update on public.bookings
for each row execute function public.bookings_guard();

-- 2) People reports: admins can read and close them.
alter table public.user_reports add column if not exists status text not null default 'open';
alter table public.user_reports add column if not exists reviewed_at timestamptz;
drop policy if exists "user_reports admin read" on public.user_reports;
create policy "user_reports admin read" on public.user_reports for select to authenticated using (public.is_admin());
drop policy if exists "user_reports admin update" on public.user_reports;
create policy "user_reports admin update" on public.user_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.user_reports to authenticated;
grant update (status, reviewed_at) on public.user_reports to authenticated;

-- 3) Needs: only the person who asked, and owners of shops, can read them (strangers cannot list everyone's requests).
drop policy if exists "needs read" on public.needs;
create policy "needs read" on public.needs for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.places p where p.claimed_by = auth.uid()));
