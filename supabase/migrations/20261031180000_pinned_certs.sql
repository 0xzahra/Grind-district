alter table public.public_profiles add column if not exists pinned text[] not null default '{}';
grant select (pinned) on public.public_profiles to anon, authenticated;
