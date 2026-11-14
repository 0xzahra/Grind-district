-- Certificates the server issued (or verified from an earlier share link). The public certificate page
-- renders only from these rows. Service role only: RLS on, no policies, so clients can neither read nor write.
create table if not exists public.certificates (
  cert_id text primary key check (length(cert_id) between 8 and 1024),
  serial text not null check (serial ~ '^GD-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  username text not null,
  privy_user_id text,
  course_id text not null,
  course_title text not null,
  player_name text not null,
  issued_ms bigint,
  issued_date text,
  tries int,
  source text not null default 'issued' check (source in ('issued', 'legacy-save', 'legacy-chain')),
  created_at timestamptz not null default now()
);
create index if not exists certificates_serial_idx on public.certificates (serial);
create unique index if not exists certificates_issued_once on public.certificates (username, course_id) where source = 'issued';
alter table public.certificates enable row level security;
revoke all on table public.certificates from anon, authenticated;
