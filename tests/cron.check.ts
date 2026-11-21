// Scheduled routes: only Vercel Cron's Bearer CRON_SECRET gets in (dry runs included); no network, no database.
import { randomBytes } from 'node:crypto'
process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real'
const { cronAuthorized } = await import('../api/_cron.ts')
let fails = 0
const expect = (name: string, c: boolean) => { if (!c) { fails++; console.error('FAIL - ' + name) } }
delete process.env.CRON_SECRET
expect('no CRON_SECRET set: refused', !cronAuthorized({ authorization: 'Bearer ' }))
const secret = randomBytes(24).toString('hex')
process.env.CRON_SECRET = secret
expect('right bearer passes', cronAuthorized({ authorization: `Bearer ${secret}` }))
expect('no header refused', !cronAuthorized({}))
expect('wrong bearer refused', !cronAuthorized({ authorization: `Bearer ${secret}x` }))
type Out = { code: number }
const call = async (mod: string, req: Record<string, unknown>): Promise<Out> => {
  const h = (await import(mod)).default as (q: unknown, r: unknown) => Promise<void>
  const out: Out = { code: 0 }
  await h({ headers: {}, query: {}, ...req }, { status(n: number) { out.code = n; return { json() {}, send() {} } }, setHeader() {} })
  return out
}
expect('nudge dry=1 without auth -> 401', (await call('../api/messages.ts', { method: 'GET', query: { op: 'nudge', dry: '1' } })).code === 401)
expect('nudge without auth -> 401', (await call('../api/messages.ts', { method: 'GET', query: { op: 'nudge' } })).code === 401)
expect('deposits-poll without auth -> 401', (await call('../api/deposits-poll.ts', { method: 'GET' })).code === 401)
expect('deposits-poll with cron auth gets past the check (503 while deposits are off)', (await call('../api/deposits-poll.ts', { method: 'GET', headers: { authorization: `Bearer ${secret}` } })).code === 503)
if (fails) { console.error(`${fails} cron check(s) failed`); process.exit(1) }
console.log('ok - cron routes: Bearer CRON_SECRET only')
process.exit(0)
