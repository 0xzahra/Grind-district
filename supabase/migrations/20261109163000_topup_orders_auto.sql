-- Automatic top-up orders: unique per-order amount, server verifies on-chain, credits once.
create table if not exists public.topup_orders (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text,
  player text check (player is null or player ~ '^0x[0-9a-f]{40}$'),
  asset text not null check (asset in ('ETH', 'USDC')),
  amount_raw numeric not null check (amount_raw > 0),
  tag text not null check (tag ~ '^[0-9]{6}$'),
  status text not null check (status in ('waiting', 'detected', 'credited', 'expired', 'failed')),
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  credit_micro numeric,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists topup_orders_status_idx on public.topup_orders (status, expires_at);
create index if not exists topup_orders_player_idx on public.topup_orders (player);
create unique index if not exists topup_orders_open_tag_asset_uidx
  on public.topup_orders (asset, tag) where status in ('waiting', 'detected');
create unique index if not exists topup_orders_tx_hash_uidx
  on public.topup_orders (tx_hash) where tx_hash is not null;
alter table public.topup_orders enable row level security;
revoke all on public.topup_orders from anon, authenticated;
