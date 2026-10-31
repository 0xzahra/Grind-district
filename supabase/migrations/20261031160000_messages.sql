-- Direct messages between signed-in players (usernames only; no emails, wallets or locations).
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender text not null check (sender ~ '^[a-z0-9_]{3,16}$'),
  recipient text not null check (recipient ~ '^[a-z0-9_]{3,16}$'),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_recipient_idx on public.messages (recipient, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender, created_at desc);
create table if not exists public.message_blocks (
  blocker text not null,
  blocked text not null,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists public.message_reports (
  id bigint generated always as identity primary key,
  reporter text not null,
  reported text not null,
  message_id bigint references public.messages(id) on delete set null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
-- Only the service role (Vercel /api/messages, Privy-verified) reads and writes. No anon policies.
alter table public.messages enable row level security;
alter table public.message_blocks enable row level security;
alter table public.message_reports enable row level security;
