import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { makeAgentPrompt, PERSON_SESSION_API, PRACTICE_BALANCE_NOTE } from './agent-prompt.ts'
for (const origin of ['https://grind-district-git-fix-gdd-six-preview-zahra-projects.vercel.app', 'https://production.example', 'http://localhost:47321']) {
  const text = makeAgentPrompt(origin)
  assert(text.includes(origin + '/'), 'instructions use current origin in preview, production and local')
  assert(!text.includes('grinddistrict.vercel.app'), 'never hardcode unrelated production')
  assert(!/claim code:|YOUR OWN|\{\{|POST \/api\/agent|GET \/api\/agent/.test(text), 'no fabricated email/claim placeholders or unsupported API calls')
  assert(text.includes('Neither flow is available') && text.includes('must never relabel a person'), 'owner link is distinct from robot registration')
  assert(text.includes("other people's conversations") && text.includes('Do not invent an email'), 'privacy and identity safeguards retained')
}
for (const origin of ['javascript:alert(1)', 'https://user:password@example.test']) assert.throws(() => makeAgentPrompt(origin))
const apiFiles = readdirSync('api', { recursive: true }).filter(name => name.endsWith('.ts'))
assert.deepEqual(apiFiles, ['privy/session.ts'], 'capability assertion must be re-reviewed when API routes change')
const endpoint = readFileSync('api' + PERSON_SESSION_API.path.slice(4) + '.ts', 'utf8')
assert(endpoint.includes("req.method !== 'POST'") && endpoint.includes('405'))
assert(endpoint.includes('verifyPrivySession(bearer(req.headers.authorization))'), 'actual owner sign-in checks Authorization through server verifier')
assert(readFileSync('server/verify-session.ts', 'utf8').includes('verifyAccessToken(token)'), 'not an unverified client ID')
assert(PERSON_SESSION_API.method === 'POST' && PERSON_SESSION_API.auth.includes('server-verified'))
assert(PRACTICE_BALANCE_NOTE.includes('cannot be withdrawn') && PRACTICE_BALANCE_NOTE.includes('not wallet funds') && PRACTICE_BALANCE_NOTE.includes('does not initiate'))
assert(!/nothing on.?chain moves/i.test(PRACTICE_BALANCE_NOTE))
console.log('agent capability/origin/API method/auth/copy/practice distinction checks passed')

// Execute the actual owner-session HTTP adapter with only its verifier mocked.
// No real tokens, credentials, registration, network or auth provider changes.
const mock = 'data:text/javascript,' + encodeURIComponent(`export async function verifyPrivySession(token) { return token === 'synthetic-valid' ? {id:'did:privy:synthetic_owner_0001'} : {error:'Privy did not accept that login.'} }`)
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../../server/verify-session.ts' && context.parentURL?.endsWith('/api/privy/session.ts')) return { url: mock, shortCircuit: true }
  return next(specifier, context)
} })
const { default: sessionHandler } = await import('../api/privy/session.ts')
async function request(method, authorization) {
  const response = { statusCode: 0, setHeader() {}, end(body) { this.body = JSON.parse(body) } }
  await sessionHandler({ method, headers: { authorization } }, response)
  return response
}
assert.equal((await request('GET')).statusCode, 405)
assert.equal((await request('POST')).statusCode, 401)
assert.equal((await request('POST', 'Bearer synthetic-invalid')).statusCode, 401)
const valid = await request('POST', 'Bearer synthetic-valid')
assert.equal(valid.statusCode, 200)
assert.equal(valid.body.id, 'did:privy:synthetic_owner_0001')
console.log('actual person-session adapter method/token boundary checks passed (mock verifier, no live auth)')
