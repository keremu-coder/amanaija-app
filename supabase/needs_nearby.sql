-- Shop owners see only the requests near THEIR shop, and never who asked. Safe to run more than once.
create or replace function public.nearby_needs(p_place uuid) returns table (id uuid, body text, lat double precision, lng double precision, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare pl public.places;
begin
  select * into pl from public.places where places.id = p_place and claimed_by = auth.uid();
  if not found then return; end if;
  return query
    select n.id, n.body, n.lat, n.lng, n.created_at
    from public.needs n
    where n.status = 'open' and n.expires_at > now()
      and abs(n.lat - pl.lat) < 0.04 and abs(n.lng - pl.lng) < 0.04
    order by n.created_at desc limit 30;
end $$;
revoke all on function public.nearby_needs(uuid) from public, anon;
grant execute on function public.nearby_needs(uuid) to authenticated;

-- From now on a person can read only their own requests directly.
drop policy if exists "needs read" on public.needs;
create policy "needs read" on public.needs for select to authenticated using (user_id = auth.uid());
