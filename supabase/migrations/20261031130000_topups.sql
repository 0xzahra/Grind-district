-- On-chain top-ups to GrindLedger (Base). One row per payment tx; only the server (service role) writes.
create table if not exists public.topups (
  tx_hash text primary key check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  player text not null check (player ~ '^0x[0-9a-f]{40}$'),
  privy_user_id text,
  asset text not null check (asset in ('ETH', 'USDC')),
  amount_raw numeric not null,
  usd_micro numeric not null,
  fee_micro numeric not null,
  credit_micro numeric not null,
  block_number bigint not null,
  status text not null check (status in ('pending', 'credited', 'failed')),
  credit_tx text,
  error text,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists topups_player_idx on public.topups (player);
alter table public.topups enable row level security;
-- No policies: anon/authenticated cannot read or write. The /api functions use the service role.
revoke all on public.topups from anon, authenticated;
