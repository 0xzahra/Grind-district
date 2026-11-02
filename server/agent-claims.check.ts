import type { IncomingMessage, ServerResponse } from 'node:http'
import { createAgentClaim, checkFirstEarnClaim, AGENT_CLAIM_TTL_SECONDS, FIRST_EARN_WAIT_SECONDS } from './agent-claims.ts'
import handler from '../api/agents/first-earn.ts'

let failures = 0

function check(condition: boolean, message: string): void {
  if (condition) return
  failures += 1
  console.error(message)
}

const secret = 'test-only-claim-signing-secret'
const owner = 'did:privy:cldistrict01'
const now = Date.now()
const fresh = createAgentClaim(owner, secret, now)
check(fresh !== null, 'a verified Privy DID gets a signed claim')
if (fresh) {
  const newCode = checkFirstEarnClaim(fresh.code, secret, now)
  check(newCode.ok && !newCode.eligible && newCode.waitSeconds === FIRST_EARN_WAIT_SECONDS, 'fresh claim cannot pass the first-earn wait')
  const ready = checkFirstEarnClaim(fresh.code, secret, now + FIRST_EARN_WAIT_SECONDS * 1000)
  check(ready.ok && ready.eligible && ready.waitSeconds === 0, 'claim passes after the server wait')
  check(checkFirstEarnClaim(fresh.code, 'different-secret', now).ok === false, 'claim signature is bound to the server secret')
  const tampered = `${fresh.code.slice(0, -1)}${fresh.code.endsWith('a') ? 'b' : 'a'}`
  check(checkFirstEarnClaim(tampered, secret, now).ok === false, 'tampered claims are rejected')
  check(checkFirstEarnClaim(fresh.code, secret, now + AGENT_CLAIM_TTL_SECONDS * 1000).ok === false, 'expired claims are rejected')
  check(checkFirstEarnClaim(fresh.code, secret, now - 1_000).ok === false, 'future-issued claims are rejected')
  const later = createAgentClaim(owner, secret, now + 1_000)
  check(later !== null && later.code !== fresh.code, 'copying a fresh prompt issues a different claim')
  if (later) {
    const resetWait = checkFirstEarnClaim(later.code, secret, now + 1_000)
    check(resetWait.ok && resetWait.waitSeconds === FIRST_EARN_WAIT_SECONDS, 'a renewed claim starts its own wait')
  }
}
check(createAgentClaim(owner, '', now) === null, 'claims fail closed without the existing server secret')
check(createAgentClaim('not-a-privy-id', secret, now) === null, 'claims require a verified Privy DID')

function mockResponse(): ServerResponse & { body: string } {
  const result = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(body: string) { result.body = body },
  }
  return result as unknown as ServerResponse & { body: string }
}

async function callGate(code: string | null, method = 'POST'): Promise<ServerResponse & { body: string }> {
  const req = {
    method,
    headers: code ? { authorization: `Bearer ${code}` } : {},
  } as IncomingMessage
  const res = mockResponse()
  await handler(req, res)
  return res
}

const originalSecret = process.env.PRIVY_APP_SECRET
process.env.PRIVY_APP_SECRET = secret
try {
  if (fresh) {
    const tooSoon = await callGate(fresh.code)
    check(tooSoon.statusCode === 425 && JSON.parse(tooSoon.body).eligible === false, 'HTTP gate returns 425 during the wait')

    const agedCode = createAgentClaim(owner, secret, Date.now() - (FIRST_EARN_WAIT_SECONDS + 1) * 1000)
    if (agedCode) {
      const passed = await callGate(agedCode.code)
      const result = JSON.parse(passed.body) as { eligible?: boolean; creditsIssued?: boolean }
      check(passed.statusCode === 200 && result.eligible === true, 'HTTP gate accepts a valid aged claim')
      check(result.creditsIssued === false, 'the gate does not credit funds')
    }

    const expiredCode = createAgentClaim(owner, secret, Date.now() - (AGENT_CLAIM_TTL_SECONDS + 1) * 1000)
    if (expiredCode) {
      const expired = await callGate(expiredCode.code)
      check(expired.statusCode === 401, 'HTTP gate rejects expired claims')
    }
  }
  const wrongMethod = await callGate(null, 'GET')
  check(wrongMethod.statusCode === 405, 'HTTP gate only accepts POST')
  delete process.env.PRIVY_APP_SECRET
  const noConfig = await callGate('anything')
  check(noConfig.statusCode === 503, 'HTTP gate fails closed when signing config is absent')
} finally {
  if (originalSecret === undefined) delete process.env.PRIVY_APP_SECRET
  else process.env.PRIVY_APP_SECRET = originalSecret
}

if (failures) throw new Error(`${failures} agent claim checks failed`)
console.log('agent claim checks passed')
