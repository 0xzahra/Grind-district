-- Public profile snapshot for share cards (/cv/<username>, /api/og). Public read; writes only via /api/profile (service role, Privy-verified).
create table if not exists public.public_profiles (
  username text primary key check (username ~ '^[a-z0-9_]{3,16}$'),
  privy_user_id text not null unique,
  name text not null default '' check (char_length(name) <= 40),
  rank text not null default '' check (char_length(rank) <= 24),
  reputation integer not null default 0,
  balance numeric(14,2) not null default 0,
  skills text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.public_profiles enable row level security;
drop policy if exists public_profiles_read on public.public_profiles;
create policy public_profiles_read on public.public_profiles for select to anon, authenticated using (true);
revoke insert, update, delete on public.public_profiles from anon, authenticated;
-- Keep the Privy id private: anon/auth may read only the card columns.
revoke select on public.public_profiles from anon, authenticated;
grant select (username, name, rank, reputation, balance, skills, updated_at) on public.public_profiles to anon, authenticated;
