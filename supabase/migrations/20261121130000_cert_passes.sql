-- Server-graded certificate exam passes (api/_certExam.ts via op=cert-grade). A new certificate record is issued
-- only for a player and course with a row here. One row per player and course; the first pass is kept.
-- Service role only (RLS on, no policies).
create table if not exists public.cert_passes (
  privy_user_id text not null check (length(privy_user_id) between 3 and 200),
  course_id text not null check (length(course_id) between 1 and 40),
  username text not null check (length(username) between 1 and 40),
  score int check (score is null or score >= 0),
  of_total int check (of_total is null or of_total > 0),
  source text not null default 'exam' check (source in ('exam', 'backfill-cert')),
  passed_at timestamptz not null default now(),
  primary key (privy_user_id, course_id)
);
alter table public.cert_passes enable row level security;
revoke all on table public.cert_passes from anon, authenticated;

-- Certificates already issued before passes were recorded count as passed for that player and course.
insert into public.cert_passes (privy_user_id, course_id, username, source, passed_at)
select c.privy_user_id, c.course_id, c.username, 'backfill-cert', coalesce(c.created_at, now())
from public.certificates c
where c.source = 'issued' and c.privy_user_id is not null
on conflict (privy_user_id, course_id) do nothing;
