-- public_profiles: the money figure stays server-side. Card readers (anon / authenticated) keep the card columns
-- (username, name, rank, reputation, skills, pinned, updated_at); balance is read only by the API with the service
-- role. Idempotent: revoking a privilege that is not held is a no-op.
revoke select (balance) on public.public_profiles from anon, authenticated;
