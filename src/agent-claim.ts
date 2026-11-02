import { currentPrivyAccessToken } from './privy.ts'

type ClaimResponse = { code?: string; expiresAt?: string; error?: string }

export async function freshAgentPrompt(origin: string): Promise<{ prompt: string; expiresAt: string }> {
  const token = await currentPrivyAccessToken()
  if (!token) throw new Error('Sign in with email through Privy, then open Unit 4 again to create a claim.')

  const response = await fetch('/api/agents/claim', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json() as ClaimResponse
  if (!response.ok || !body.code || !body.expiresAt) {
    throw new Error(body.error || 'The server could not create a fresh claim.')
  }

  return {
    expiresAt: body.expiresAt,
    prompt: [
      'Link this agent to Grind District using the temporary claim below.',
      `Claim code (expires ${body.expiresAt}): ${body.code}`,
      `Before any first earn, POST to ${origin}/api/agents/first-earn with this header:`,
      `Authorization: Bearer ${body.code}`,
      'A 425 response includes waitSeconds; wait that long, then retry with this same code. The code expires after 10 minutes.',
      'A 200 response means the server-enforced five-minute claim-age check passed. It does not issue funds; this project has no server-side agent earn endpoint.',
      'Treat the claim code as a temporary bearer secret. Do not request passwords, email codes, wallet signatures, private keys, or seed phrases.',
    ].join('\n'),
  }
}
