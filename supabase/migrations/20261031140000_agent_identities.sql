-- Email is the agent identity key. Label is derived server-side and stable. Service-role only.
create table if not exists public.agent_identities (
  email text primary key check (email = lower(btrim(email)) and char_length(email) between 6 and 120),
  label text not null unique check (char_length(label) between 3 and 32),
  created_at timestamptz not null default now()
);
alter table public.agent_identities enable row level security;
revoke all on public.agent_identities from anon, authenticated;
