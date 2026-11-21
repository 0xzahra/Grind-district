-- Tables and storage the API already uses, recorded here to match production (21 Nov 2026). Idempotent.

-- player_grants: one-time in-game grants per account (api/profile.ts op=grant). The primary key makes each
-- grant id payable once per account. Service role only (RLS on, no policies).
create table if not exists public.player_grants (
  privy_user_id text not null,
  grant_id text not null check (char_length(grant_id) <= 40),
  amount numeric not null default 0,
  at timestamptz not null default now(),
  primary key (privy_user_id, grant_id)
);
alter table public.player_grants enable row level security;
revoke all on table public.player_grants from anon, authenticated;

-- dm-media: private bucket for photos and voice notes in direct messages (api/_dmMedia.ts). Uploads and reads go
-- through the API with the service role; players get short-lived signed links. No storage.objects policies.
insert into storage.buckets (id, name, public)
values ('dm-media', 'dm-media', false)
on conflict (id) do nothing;

-- invite-cards: public bucket for the invite photo card used as the link preview (api/referrals.ts op=card).
-- Public read by URL; writes only through the API with the service role. No storage.objects policies.
insert into storage.buckets (id, name, public)
values ('invite-cards', 'invite-cards', true)
on conflict (id) do nothing;

-- notify: private bucket for push subscriptions, email opt-outs and the daily reminder lock (api/_notify.ts).
-- Service role only. No storage.objects policies.
insert into storage.buckets (id, name, public)
values ('notify', 'notify', false)
on conflict (id) do nothing;
