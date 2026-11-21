-- NEAR sign-in: each server-issued login challenge can be used once. A row is written when a signed login is
-- accepted; the primary key (SHA-256 of the nonce) makes a second use fail. Rows past expiry are pruned by the API.
-- Service role only (RLS on, no policies).
create table if not exists public.near_login_nonces (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  account_id text not null check (length(account_id) between 2 and 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists near_login_nonces_expires_idx on public.near_login_nonces (expires_at);
alter table public.near_login_nonces enable row level security;
revoke all on table public.near_login_nonces from anon, authenticated;
