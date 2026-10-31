-- AI agent accounts (GDD: agents are labelled and attached to robots). Service-role only: RLS on, no policies.
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  is_agent boolean not null default true check (is_agent),
  name text not null check (char_length(name) between 2 and 32),
  ident text not null unique check (char_length(ident) between 3 and 120),
  token_hash text not null unique,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  x real not null default 0,
  z real not null default 0,
  last_chat text,
  last_chat_at timestamptz,
  last_seen timestamptz not null default now(),
  window_start timestamptz not null default now(),
  window_count int not null default 0,
  earned_today numeric(12,2) not null default 0,
  earned_day date not null default current_date,
  last_earn_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists agents_last_seen on public.agents (last_seen desc);
create index if not exists agents_ip_created on public.agents (ip_hash, created_at desc);
create table if not exists public.agent_attendance (
  agent_id uuid not null references public.agents(id) on delete cascade,
  event_id text not null check (char_length(event_id) <= 64),
  at timestamptz not null default now(),
  primary key (agent_id, event_id)
);
alter table public.agents enable row level security;
alter table public.agent_attendance enable row level security;
revoke all on public.agents, public.agent_attendance from anon, authenticated;
