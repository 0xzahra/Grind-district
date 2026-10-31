import { PrivyClient } from '@privy-io/node'

export type PrivySession = { id: string } | { error: string }

function appId(): string {
  return (process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || '').trim()
}

export async function verifyPrivySession(token: string): Promise<PrivySession> {
  const id = appId()
  const secret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!secret) return { error: 'The server has no Privy secret.' }
  if (!id) return { error: 'The server has no Privy App ID.' }
  if (!token) return { error: 'Privy did not send a login.' }
  try {
    const privy = new PrivyClient({ appId: id, appSecret: secret })
    const claims = await privy.utils().auth().verifyAccessToken(token)
    if (!claims.user_id.startsWith('did:privy:')) return { error: 'Privy did not accept that login.' }
    return { id: claims.user_id }
  } catch {
    return { error: 'Privy did not accept that login.' }
  }
}
