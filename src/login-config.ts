export type GameLoginMethod = 'email' | 'google' | 'twitter'
/** Public allowlist declares providers already enabled by the app owner in Privy. */
export function loginMethods(raw?: string): GameLoginMethod[] {
  const methods: GameLoginMethod[] = ['email']
  for (const token of (raw ?? '').split(',').map(value => value.trim().toLowerCase())) {
    if ((token === 'google' || token === 'twitter') && !methods.includes(token)) methods.push(token)
  }
  return methods
}
