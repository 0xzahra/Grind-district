-- In-game wallets (one per player, created on sign-up) and an append-only ledger. No keys are stored.
create table if not exists public.wallets (
  privy_user_id text primary key,
  deposit_tag text not null unique check (deposit_tag ~ '^[0-9]{6}$'),
  balance numeric(18, 2) not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  privy_user_id text not null references public.wallets (privy_user_id),
  amount numeric(18, 2) not null,
  kind text not null check (kind in ('deposit', 'spend', 'transfer_in', 'transfer_out', 'fee', 'grant')),
  ref text,
  tx_hash text,
  log_index int,
  created_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);
create table if not exists public.deposit_cursor (id int primary key, block bigint not null);
alter table public.wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.deposit_cursor enable row level security;
-- No anon policies: all reads/writes go through the API with the service role.
create or replace function public.wallet_credit(p_user text, p_amount numeric) returns void
language sql security definer set search_path = public as $$
  update public.wallets set balance = balance + p_amount where privy_user_id = p_user;
$$;
revoke all on function public.wallet_credit(text, numeric) from public, anon, authenticated;
