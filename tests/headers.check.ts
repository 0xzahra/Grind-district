// Site-wide response headers (vercel.json): the game cannot be framed by other sites, browsers do not guess file
// types, and full page addresses (?ref= / ?src=) are not sent to other sites. No script or connect limits here.
import { readFileSync } from 'node:fs'
const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }
const all = cfg.headers.find((h) => h.source === '/(.*)')
const get = (k: string) => all?.headers.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value ?? ''
let fail = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok' : '  FAIL', m); if (!c) fail++ }
ok(!!all, 'one rule covers every path')
ok(/frame-ancestors 'none'/.test(get('Content-Security-Policy')) && get('X-Frame-Options') === 'DENY', 'no framing by other sites')
ok(!/script-src|connect-src|default-src/.test(get('Content-Security-Policy')), 'CSP does not limit scripts or connections (Privy, wallets, Supabase keep working)')
ok(get('X-Content-Type-Options') === 'nosniff', 'nosniff')
ok(get('Referrer-Policy') === 'strict-origin-when-cross-origin', 'referrer policy')
ok(cfg.headers.some((h) => h.source === '/assets/(.*)'), 'asset cache rules still there')
console.log(fail ? `headers: ${fail} failed` : 'headers ok')
if (fail) process.exit(1)
