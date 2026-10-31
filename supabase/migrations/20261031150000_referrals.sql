-- Invite links: who joined via whose link. Usernames only (no emails, wallets or locations).
create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  invitee_username text not null unique check (invitee_username ~ '^[a-z0-9_]{3,16}$'),
  inviter_username text not null check (inviter_username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);
create index if not exists referrals_inviter_idx on public.referrals (lower(inviter_username));
-- Only the service role (Vercel /api functions) reads and writes.
alter table public.referrals enable row level security;
