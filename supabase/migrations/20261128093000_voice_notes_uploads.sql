-- voice-notes: no direct uploads with the public key. Proximity voice notes are off (VITE_VOICE_NOTES unset); when
-- they come back, uploads should go through an authenticated API route with per-player folders (like dm-media).
-- Files already in the bucket stay readable. Idempotent.
drop policy if exists "voice notes upload" on storage.objects;
