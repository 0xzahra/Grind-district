// Database privileges recorded in supabase/migrations: what the public key may read or write. Static check of the
// migration files (they were also run twice against an in-memory Postgres when written, see the commit).
import { readdirSync, readFileSync } from 'node:fs'
const dir = new URL('../supabase/migrations/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const sql = (f: string) => readFileSync(new URL(f, dir), 'utf8').toLowerCase()
const all = files.map(sql).join('\n')
let fail = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok' : '  FAIL', m); if (!c) fail++ }
const lastIndex = (re: RegExp) => { let i = -1; for (const m of all.matchAll(new RegExp(re, 'g'))) i = m.index!; return i }
ok(lastIndex(/revoke select \(balance\) on public\.public_profiles from anon, authenticated/) > lastIndex(/grant select \([^)]*balance[^)]*\) on public\.public_profiles/), 'balance is revoked after the last grant that included it')
ok(!/grant select \([^)]*balance/.test(files.filter((f) => f >= '20261128').map(sql).join('\n')), 'no later migration grants balance again')
for (const t of ['messages', 'message_blocks', 'message_reports', 'players', 'player_progress', 'referrals', 'events', 'wallets', 'wallet_ledger', 'deposit_cursor']) ok(all.includes(`'${t}'`) && /revoke all on table public\.%i from anon, authenticated/.test(all), `no public-key privileges on ${t}`)
ok(/revoke truncate, trigger, references on table public\.public_profiles from anon, authenticated/.test(all), 'public_profiles: no truncate/trigger/references for the public key')
ok(lastIndex(/drop policy if exists "voice notes upload"/) > lastIndex(/create policy "voice notes upload"/), 'no direct uploads into voice-notes with the public key')
ok(/create table if not exists public\.cert_exam_papers[\s\S]*revoke all on table public\.cert_exam_papers from anon, authenticated/.test(all), 'exam paper record is service-role only')
// The browser never reads profiles straight from Supabase; card readers on the server do not ask for balance.
const srcHits = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.ts')).filter((f) => /public_profiles/.test(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')))
ok(srcHits.length === 0, 'no browser code reads public_profiles directly')
for (const f of ['_profile.ts', 'og.ts', 'messages.ts', 'referrals.ts']) {
  const s = readFileSync(new URL(`../api/${f}`, import.meta.url), 'utf8')
  ok(![...s.matchAll(/from\('public_profiles'\)\.select\('([^']*)'\)/g)].some((m) => m[1]!.split(',').includes('balance')) && !/public_profiles\?[^`]*balance/.test(s), `api/${f} card reads never include balance`)
}
console.log(fail ? `db grants: ${fail} failed` : 'db grants ok')
if (fail) process.exit(1)
