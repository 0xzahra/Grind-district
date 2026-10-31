-- Public-read bucket for proximity voice notes (max ~30 s, small opus/mp4 files).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', true, 1048576, array['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;
-- Anyone with the anon key may upload into the bucket (no overwrite/delete).
create policy "voice notes upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'voice-notes');
-- Cleanup (TTL ~24 h): schedule with pg_cron, e.g.
--   select cron.schedule('voice-notes-ttl', '0 * * * *',
--     $$delete from storage.objects where bucket_id = 'voice-notes' and created_at < now() - interval '24 hours'$$);
