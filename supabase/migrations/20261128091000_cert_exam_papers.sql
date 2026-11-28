-- cert_exam_papers: each certificate exam paper can be handed in once (api/_certExam.ts consumePaper), and failed
-- papers per player and course are limited per hour. Service role only (RLS on, no policies). Idempotent.
create table if not exists public.cert_exam_papers (
  paper_hash text primary key check (char_length(paper_hash) = 64),
  username text not null,
  course_id text not null check (char_length(course_id) <= 40),
  passed boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists cert_exam_papers_recent on public.cert_exam_papers (username, course_id, at desc);
alter table public.cert_exam_papers enable row level security;
revoke all on table public.cert_exam_papers from anon, authenticated;
