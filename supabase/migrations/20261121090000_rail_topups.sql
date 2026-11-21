-- Optional payment rails for top-ups (off until configured): Solana (SOL / USDC via Solana Pay) and NEAR Intents
-- (pay from any supported chain; 1Click delivers USDC to the Grind District NEAR account). Service role only.
-- rail_topups: one row per credited payment. The primary key ('sol:<signature>' or 'intents:<deposit address>')
-- means a payment can be credited once.
create table if not exists public.rail_topups (
  id text primary key check (length(id) between 8 and 160),
  rail text not null check (rail in ('solana', 'intents')),
  privy_user_id text,
  payer text check (payer is null or length(payer) between 2 and 128),
  asset text not null check (length(asset) between 2 and 160),
  amount_raw numeric(40, 0) not null check (amount_raw > 0),
  usd_micro bigint not null check (usd_micro >= 0),
  fee_micro bigint not null check (fee_micro >= 0),
  credit_micro bigint not null check (credit_micro >= 0),
  order_id uuid,
  status text not null default 'credited' check (status in ('credited')),
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists rail_topups_payer_idx on public.rail_topups (payer, credited_at desc);
create index if not exists rail_topups_user_idx on public.rail_topups (privy_user_id, credited_at desc);
alter table public.rail_topups enable row level security;
revoke all on table public.rail_topups from anon, authenticated;

-- rail_topup_orders: "I'm about to pay $X with asset Y" so the server knows what to look for.
-- Solana: ref is the Solana Pay reference key. NEAR Intents: ref is the 1Click deposit address (quote kept in full).
create table if not exists public.rail_topup_orders (
  id uuid primary key default gen_random_uuid(),
  rail text not null check (rail in ('solana', 'intents')),
  privy_user_id text,
  payer text check (payer is null or length(payer) between 2 and 128),
  asset text not null check (length(asset) between 2 and 160),
  amount_raw numeric(40, 0) not null check (amount_raw > 0),
  usd_micro bigint not null check (usd_micro > 0),
  ref text not null unique check (length(ref) between 8 and 128),
  memo text,
  quote jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'credited', 'refunded', 'failed')),
  topup_id text unique,
  credit_micro bigint,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create index if not exists rail_topup_orders_payer_idx on public.rail_topup_orders (payer, created_at desc);
alter table public.rail_topup_orders enable row level security;
revoke all on table public.rail_topup_orders from anon, authenticated;
