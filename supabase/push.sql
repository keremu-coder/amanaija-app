-- Push notification subscriptions. Only the server reads or writes this table.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;
