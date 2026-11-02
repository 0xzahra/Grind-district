import { getPrivyAccessToken } from './privy.ts'

export type TopupBalanceResult = { ok: true; balanceMicros: string } | { ok: false; error: string }
export type TopupVerifyResult = {
  ok: true
  creditedMicros: string
  balanceMicros: string
  alreadyProcessed: boolean
} | { ok: false; error: string }

type ApiBody = Record<string, unknown>

function apiBody(value: unknown): ApiBody | null {
  return value !== null && typeof value === 'object' ? value as ApiBody : null
}

function micros(value: unknown): string | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : null
}

async function request(path: string, method: 'GET' | 'POST', hash?: string): Promise<ApiBody> {
  const token = await getPrivyAccessToken()
  if (!token) throw new Error('Log in with Privy before viewing or verifying top-ups.')
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hash ? { 'content-type': 'application/json' } : {}),
    },
    ...(hash ? { body: JSON.stringify({ hash }) } : {}),
  })
  const body = apiBody(await response.json())
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'The top-up service could not verify this request.')
  if (!body) throw new Error('The top-up service returned an invalid response.')
  return body
}

export async function getTopupBalance(): Promise<TopupBalanceResult> {
  try {
    const body = await request('/api/topup/balance', 'GET')
    const balanceMicros = micros(body.balanceMicros)
    return balanceMicros === null
      ? { ok: false, error: 'The top-up service returned an invalid balance.' }
      : { ok: true, balanceMicros }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The top-up balance could not be loaded.' }
  }
}

export async function verifyTopup(hash: string): Promise<TopupVerifyResult> {
  try {
    const body = await request('/api/topup/verify', 'POST', hash.trim())
    const creditedMicros = micros(body.creditedMicros)
    const balanceMicros = micros(body.balanceMicros)
    if (creditedMicros === null || balanceMicros === null || typeof body.alreadyProcessed !== 'boolean') {
      return { ok: false, error: 'The top-up service returned an invalid verification result.' }
    }
    return { ok: true, creditedMicros, balanceMicros, alreadyProcessed: body.alreadyProcessed }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The top-up could not be verified.' }
  }
}
