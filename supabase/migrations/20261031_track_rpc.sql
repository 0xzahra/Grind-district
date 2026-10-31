-- Anon-callable, validated event insert (analytics only). The events table stays closed by RLS.
-- Used by /api/track when no service-role key is configured.
create or replace function public.track_events(p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then return 0; end if;
  insert into public.events (name, anon_id, session_id, props, client_at)
  select e->>'name', left(coalesce(e->>'anon_id',''),64), left(coalesce(e->>'session_id',''),64),
         case when jsonb_typeof(e->'props')='object' and length((e->'props')::text) < 4000 then e->'props' else '{}'::jsonb end,
         case when (e->>'at') ~ '^\d{4}-\d\d-\d\dT' then (e->>'at')::timestamptz else null end
  from jsonb_array_elements(p_events) e
  where e->>'name' in ('first_visit','session_start','signup','course_start','course_complete','cert_shared','cv_shared','share_click','transfer','topup_attempt');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.track_events(jsonb) from public;
grant execute on function public.track_events(jsonb) to anon, authenticated;
