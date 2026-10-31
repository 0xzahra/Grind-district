-- Activity events (written only by /api/track with the service role).
create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null,
  anon_id text not null default '',
  session_id text not null default '',
  props jsonb not null default '{}'::jsonb,
  client_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists events_name_created_idx on public.events (name, created_at);
create index if not exists events_anon_idx on public.events (anon_id, created_at);
alter table public.events enable row level security;
-- No anon policies: anon cannot read or write directly. Inserts go through /api/track (service role).
