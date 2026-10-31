-- Friends and parties (max 4). Service role only via /api/messages (Privy-verified). No anon policies.
create table if not exists public.friendships (
  a text not null check (a ~ '^[a-z0-9_]{3,16}$'),
  b text not null check (b ~ '^[a-z0-9_]{3,16}$'),
  requester text not null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  leader text not null,
  members text[] not null default '{}' check (cardinality(members) <= 4),
  invites text[] not null default '{}',
  spot jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists parties_members_idx on public.parties using gin (members);
create index if not exists parties_invites_idx on public.parties using gin (invites);
alter table public.friendships enable row level security;
alter table public.parties enable row level security;
revoke all on public.friendships, public.parties from anon, authenticated;
