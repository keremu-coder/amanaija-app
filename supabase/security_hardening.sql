-- AmaNaija security hardening (safe to run more than once)

-- 1. Places: nobody can insert directly (claims go through claim_new_place); anon can only read.
drop policy if exists "Allow authenticated inserts" on public.places;
revoke insert, update, delete on public.places from anon;
revoke insert, delete on public.places from authenticated;

-- 2. Tighten table privileges
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

-- 3. Orders: only create_order() may create orders; sellers may only change status and packing video
drop policy if exists "Enable insert for everyone" on public.orders;
drop policy if exists "Enable insert for everyone" on public.order_items;
revoke insert on public.orders, public.order_items from anon, authenticated;
revoke update on public.orders from authenticated;
grant update (status, packing_video_url) on public.orders to authenticated;

create or replace function public.orders_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.role() in ('anon', 'authenticated') and new.status is distinct from old.status and new.status = 'Payment Verified' then
    raise exception 'Only the payment system can verify payment';
  end if;
  return new;
end $$;
drop trigger if exists orders_guard on public.orders;
create trigger orders_guard before update on public.orders for each row execute function public.orders_guard();

-- 4. Admin helper and admin-only audit log writes
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "System can insert audit logs" on public.admin_audit_log;
drop policy if exists "Admins insert audit logs" on public.admin_audit_log;
create policy "Admins insert audit logs" on public.admin_audit_log for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

-- 5. Profiles hold emails and IP hashes: stop public reading
drop policy if exists "Public can view basic profiles" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles for select to authenticated using (public.is_admin());
revoke select on public.profiles from anon;
revoke insert on public.profiles from authenticated;

-- 6. Old chat tables: no public reading or open inserts of blocks, no anon updates of reports
drop policy if exists "Anyone can insert blocks" on public.blocks;
drop policy if exists "Anyone can view blocks" on public.blocks;
revoke all on public.blocks from anon;
drop policy if exists "Anyone can insert reports" on public.reports;
revoke update on public.reports from anon;

-- 7. Chat messages: no delete-everything policy, no direct inserts (server route uses the service key)
drop policy if exists "Users can delete their own messages" on public.messages;
revoke insert on public.messages from anon, authenticated;

-- 8. Internal functions must not be callable from the public API
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'protect_admin_columns','protect_place_columns','handle_new_user','check_chat_rate_limit','check_item_price_limit',
      'freeze_reported_shop','rls_auto_enable','area_rate_limit','needs_guard','dm_guard','check_ip_ban','orders_guard')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'protect_admin_columns','protect_place_columns','handle_new_user','check_chat_rate_limit','check_item_price_limit',
      'freeze_reported_shop','get_order_by_code','dist_m','normalize_phone','area_rate_limit','needs_guard','dm_guard','check_ip_ban','claim_new_place')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;

-- 9. Tracking by a 4-digit code is guessable: private details need the order's secret token (or being the buyer)
drop function if exists public.get_order_by_code(text);
create or replace function public.get_order_by_code(p_short_code text, p_token text default null) returns json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_order record;
  v_shop_name text;
  v_private boolean;
begin
  select * into v_order from public.orders where short_code = p_short_code order by created_at desc limit 1;
  if v_order is null then return null; end if;
  select name into v_shop_name from public.places where id = v_order.shop_id;
  v_private := (p_token is not null and p_token = v_order.tracking_token) or (auth.uid() is not null and auth.uid() = v_order.buyer_id);
  return json_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'total_amount_kobo', case when v_private then v_order.total_amount_kobo end,
    'guest_name', case when v_private then v_order.guest_name end,
    'shop_name', v_shop_name,
    'delivery_code', case when v_private then v_order.delivery_code end,
    'booking_time', v_order.booking_time,
    'created_at', v_order.created_at
  );
end $$;
grant execute on function public.get_order_by_code(text, text) to anon, authenticated;
