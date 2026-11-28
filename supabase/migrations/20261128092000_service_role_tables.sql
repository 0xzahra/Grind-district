-- Tables the API reads and writes only with the service role: anon / authenticated hold no table privileges on
-- them (RLS stays on as well). public_profiles keeps only its card-column SELECT grant. New tables created by the
-- migration role start with no anon / authenticated privileges. Idempotent; tables that do not exist are skipped.
do $$
declare t text;
begin
  foreach t in array array['messages', 'message_blocks', 'message_reports', 'players', 'player_progress', 'referrals',
                           'events', 'wallets', 'wallet_ledger', 'deposit_cursor'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
revoke truncate, trigger, references on table public.public_profiles from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
