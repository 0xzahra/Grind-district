-- Private rewards wallet (Base) per player. Service role only (via /api/reward-wallet). Never joined into public views.
create table if not exists public.reward_wallets (
  privy_user_id text primary key,
  address text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  updated_at timestamptz not null default now()
);
alter table public.reward_wallets enable row level security;
revoke all on public.reward_wallets from anon, authenticated;
