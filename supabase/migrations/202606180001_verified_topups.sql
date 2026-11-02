create table if not exists public.verified_topup_claims (
  chain_id smallint not null check (chain_id = 8453),
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index bigint not null check (log_index >= 0),
  privy_user_id text not null check (privy_user_id like 'did:privy:%'),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  amount_micros numeric(78, 0) not null check (amount_micros > 0),
  block_number bigint not null check (block_number >= 0),
  claimed_at timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);

create index if not exists verified_topup_claims_user_idx on public.verified_topup_claims (privy_user_id);

alter table public.verified_topup_claims enable row level security;
revoke all on public.verified_topup_claims from public, anon, authenticated;
grant all on public.verified_topup_claims to service_role;

create or replace function public.claim_verified_topup(
  p_chain_id smallint,
  p_tx_hash text,
  p_log_index bigint,
  p_privy_user_id text,
  p_wallet_address text,
  p_amount_micros numeric,
  p_block_number bigint
) returns table (claimed boolean, balance_micros text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer;
begin
  insert into public.verified_topup_claims (
    chain_id, tx_hash, log_index, privy_user_id, wallet_address, amount_micros, block_number
  ) values (
    p_chain_id, lower(p_tx_hash), p_log_index, p_privy_user_id, lower(p_wallet_address), p_amount_micros, p_block_number
  ) on conflict (chain_id, tx_hash, log_index) do nothing;

  get diagnostics inserted_rows = row_count;
  claimed := inserted_rows = 1;
  select coalesce(sum(c.amount_micros), 0)::text
    into balance_micros
    from public.verified_topup_claims c
   where c.privy_user_id = p_privy_user_id;
  return next;
end;
$$;

create or replace function public.verified_topup_balance(p_privy_user_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(c.amount_micros), 0)::text
    from public.verified_topup_claims c
   where c.privy_user_id = p_privy_user_id;
$$;

revoke all on function public.claim_verified_topup(smallint, text, bigint, text, text, numeric, bigint) from public, anon, authenticated;
revoke all on function public.verified_topup_balance(text) from public, anon, authenticated;
grant execute on function public.claim_verified_topup(smallint, text, bigint, text, text, numeric, bigint) to service_role;
grant execute on function public.verified_topup_balance(text) to service_role;
