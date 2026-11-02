import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const AGENT_CLAIM_TTL_SECONDS = 10 * 60
export const FIRST_EARN_WAIT_SECONDS = 5 * 60

export type AgentClaimCheck =
  | { ok: true; eligible: boolean; waitSeconds: number; expiresAt: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'configuration' }

type AgentClaimPayload = {
  v: 1
  owner: string
  issuedAt: number
  expiresAt: number
  nonce: string
}

function signingKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('grind-district-agent-claim-v1').digest()
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', signingKey(secret)).update(payload).digest('base64url')
}

export function createAgentClaim(
  ownerId: string,
  secret: string,
  nowMs = Date.now(),
): { code: string; expiresAt: number } | null {
  if (!secret || !/^did:privy:[A-Za-z0-9_-]{8,80}$/.test(ownerId)) return null
  const issuedAt = Math.floor(nowMs / 1000)
  const expiresAt = issuedAt + AGENT_CLAIM_TTL_SECONDS
  const payload: AgentClaimPayload = {
    v: 1,
    owner: createHash('sha256').update(ownerId).digest('base64url'),
    issuedAt,
    expiresAt,
    nonce: randomBytes(18).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { code: `${encoded}.${signature(encoded, secret)}`, expiresAt }
}

function parseClaim(code: string, secret: string): AgentClaimPayload | null {
  const [encoded, supplied, extra] = code.split('.')
  if (!encoded || !supplied || extra !== undefined || encoded.length > 1024) return null
  const expected = Buffer.from(signature(encoded, secret), 'base64url')
  const received = Buffer.from(supplied, 'base64url')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<AgentClaimPayload>
    if (
      payload.v !== 1 ||
      typeof payload.owner !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.owner) ||
      typeof payload.issuedAt !== 'number' || !Number.isSafeInteger(payload.issuedAt) ||
      typeof payload.expiresAt !== 'number' || payload.expiresAt !== payload.issuedAt + AGENT_CLAIM_TTL_SECONDS ||
      typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{24}$/.test(payload.nonce)
    ) return null
    return payload as AgentClaimPayload
  } catch {
    return null
  }
}

export function checkFirstEarnClaim(code: string, secret: string, nowMs = Date.now()): AgentClaimCheck {
  if (!secret) return { ok: false, reason: 'configuration' }
  const claim = parseClaim(code, secret)
  if (!claim) return { ok: false, reason: 'invalid' }
  const now = Math.floor(nowMs / 1000)
  if (claim.issuedAt > now) return { ok: false, reason: 'invalid' }
  if (claim.expiresAt <= now) return { ok: false, reason: 'expired' }
  const waitSeconds = Math.max(0, claim.issuedAt + FIRST_EARN_WAIT_SECONDS - now)
  return { ok: true, eligible: waitSeconds === 0, waitSeconds, expiresAt: claim.expiresAt }
}
