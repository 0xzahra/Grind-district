-- Server copy of each player's save (optional sync; local save stays the source of truth). Not yet applied.
create table if not exists public.player_progress (
  privy_user_id text primary key references public.players (privy_user_id) on delete cascade,
  save jsonb not null,
  version text not null default 'v1',
  updated_at timestamptz not null default now()
);
alter table public.player_progress enable row level security;
-- Writes only via the service role from a Vercel /api function that verifies the Privy token.
