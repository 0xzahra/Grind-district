-- Grind District players: one row per Privy user, unique case-insensitive username.
create table if not exists public.players (
  id bigint generated always as identity primary key,
  privy_user_id text not null unique,
  username text not null check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists players_username_lower_idx on public.players (lower(username));
-- Only the service role (Vercel /api functions) writes. Nothing is exposed to anon.
alter table public.players enable row level security;
