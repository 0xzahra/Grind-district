import type { IncomingMessage, ServerResponse } from 'node:http'
import { checkFirstEarnClaim } from '../../server/agent-claims.ts'

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
  const result = checkFirstEarnClaim(bearer(req.headers.authorization), process.env.PRIVY_APP_SECRET ?? '')
  if (!result.ok) {
    send(res, result.reason === 'configuration' ? 503 : 401, {
      error: result.reason === 'expired'
        ? 'This claim code expired. Copy a fresh prompt.'
        : result.reason === 'configuration'
          ? 'The server has no Privy secret for agent verification.'
          : 'This claim code is not valid.',
    })
    return
  }
  if (!result.eligible) {
    send(res, 425, {
      eligible: false,
      waitSeconds: result.waitSeconds,
      expiresAt: new Date(result.expiresAt * 1000).toISOString(),
    })
    return
  }
  send(res, 200, {
    eligible: true,
    creditsIssued: false,
    expiresAt: new Date(result.expiresAt * 1000).toISOString(),
  })
}
