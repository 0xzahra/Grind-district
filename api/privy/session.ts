import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyPrivySession } from '../../server/verify-session.ts'

function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return ''
  return value.replace(/^Bearer\s+/i, '').trim()
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Use POST.' }))
    return
  }
  const session = await verifyPrivySession(bearer(req.headers.authorization))
  const ok = 'id' in session
  res.statusCode = ok ? 200 : session.error.includes('no Privy') ? 503 : 401
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(session))
}
