import type { IncomingMessage, ServerResponse } from 'node:http'
import { createAgentClaim } from '../../server/agent-claims.ts'
import { verifyPrivySession } from '../../server/verify-session.ts'

function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  return value?.replace(/^Bearer\s+/i, '').trim() ?? ''
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Use POST.' })
    return
  }
  const session = await verifyPrivySession(bearer(req.headers.authorization))
  if (!('id' in session)) {
    send(res, session.error.includes('no Privy') || session.error.includes('no server') ? 503 : 401, session)
    return
  }
  const claim = createAgentClaim(session.id, process.env.PRIVY_APP_SECRET ?? '')
  if (!claim) {
    send(res, 503, { error: 'Agent claims are unavailable until server authentication is configured.' })
    return
  }
  send(res, 201, { code: claim.code, expiresAt: new Date(claim.expiresAt * 1000).toISOString() })
}
