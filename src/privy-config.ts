export function privyAppId(): string {
  return (import.meta.env.VITE_PRIVY_APP_ID ?? '').trim()
}

export function privyConfigured(): boolean {
  return privyAppId().length > 0
}
