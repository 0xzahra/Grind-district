// The share pages (/s/stats, /p/<flyer>): each carries its picture as the link preview, and unknown flyers
// send people to the game instead of a broken page.
import assert from 'node:assert/strict'
import handler from '../api/page.ts'
import { FLYER_PAGES } from '../api/_posters.ts'
import { existsSync } from 'node:fs'

type Out = { status: number; headers: Record<string, string>; body: string }
async function call(query: Record<string, string>): Promise<Out> {
  const out: Out = { status: 0, headers: {}, body: '' }
  const res = { setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v }, status(n: number) { out.status = n; return { send(b: string | Buffer) { out.body = String(b) } } } }
  await handler({ query } as never, res as never)
  return out
}

let pass = 0, fail = 0
const t = async (name: string, fn: () => Promise<void> | void) => { try { await fn(); pass++; console.log('  ok', name) } catch (e) { fail++; console.log('  FAIL', name, (e as Error).message) } }

await t('stats page has the live stats picture as its preview', async () => {
  const r = await call({ kind: 'stats' })
  assert.equal(r.status, 200)
  assert.match(r.body, /<meta property="og:image" content="https:\/\/www\.grinddistrict\.app\/api\/og\?kind=stats&amp;h=\d+">/)
  assert.match(r.body, /twitter:card" content="summary_large_image"/)
  assert.match(r.body, /href="https:\/\/www\.grinddistrict\.app\/\?src=stats"/)
})
await t('a flyer page shows the flyer picture', async () => {
  const r = await call({ kind: 'poster', id: 'mcgrind-1' })
  assert.equal(r.status, 200)
  assert.match(r.body, /og:image" content="https:\/\/www\.grinddistrict\.app\/posters\/mcgrind-1\.jpg"/)
  assert.match(r.body, /Get hired at McGrind in Grind District/)
})
await t('an unknown flyer goes to the game', async () => {
  const r = await call({ kind: 'poster', id: 'nope<script>' })
  assert.equal(r.status, 302)
  assert.equal(r.headers.location, 'https://www.grinddistrict.app/?src=poster')
})
await t('every flyer page has its picture in public/posters', () => {
  for (const id of Object.keys(FLYER_PAGES)) assert.ok(existsSync(new URL(`../public/posters/${id}.jpg`, import.meta.url)), id)
})
console.log(`sharepage: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
