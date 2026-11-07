-- App crash and error log. People's browsers send only the error text, the page and the device type. Safe to run more than once.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  page text,
  device text,
  count int not null default 1,
  fp text unique
);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;
grant all on public.app_errors to service_role;
grant select on public.app_errors to authenticated;
drop policy if exists "app_errors admin read" on public.app_errors;
create policy "app_errors admin read" on public.app_errors for select to authenticated using (public.is_admin());
