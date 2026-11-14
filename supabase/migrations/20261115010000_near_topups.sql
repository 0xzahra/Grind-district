-- NEAR mainnet top-ups. Service role only: RLS on, no policies.
-- near_topups: one row per credited NEAR payment. The primary key on tx_hash means a payment can be credited once.
create table if not exists public.near_topups (
  tx_hash text primary key check (tx_hash ~ '^[1-9A-HJ-NP-Za-km-z]{43,44}$'),
  sender text not null check (length(sender) between 2 and 64),
  receiver text not null check (length(receiver) between 2 and 64),
  privy_user_id text,
  order_id uuid,
  yocto numeric(40, 0) not null check (yocto > 0),
  near_usd_8 numeric(30, 0) not null check (near_usd_8 > 0),
  usd_micro bigint not null check (usd_micro >= 0),
  fee_micro bigint not null check (fee_micro >= 0),
  credit_micro bigint not null check (credit_micro >= 0),
  status text not null default 'credited' check (status in ('credited')),
  error text,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists near_topups_sender_idx on public.near_topups (sender, credited_at desc);
alter table public.near_topups enable row level security;
revoke all on table public.near_topups from anon, authenticated;

-- near_topup_orders: a player's "I'm about to send X NEAR from account Y" so the server can find the payment.
create table if not exists public.near_topup_orders (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text,
  sender text not null check (length(sender) between 2 and 64),
  yocto numeric(40, 0) not null check (yocto > 0),
  status text not null default 'waiting' check (status in ('waiting', 'credited')),
  tx_hash text unique,
  credit_micro bigint,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists near_topup_orders_sender_idx on public.near_topup_orders (sender, created_at desc);
alter table public.near_topup_orders enable row level security;
revoke all on table public.near_topup_orders from anon, authenticated;
