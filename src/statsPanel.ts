// Public, counts-only rows for the Online pill card. No names, emails, or wallet addresses.

export type PublicStats = {
  registered: number
  signups: number
  signIns: number
  activeToday: number
  agentsRegistered: number
  agentsOnline: number
  mintsBase: number
  mintsNear: number
  mintsNearNetwork: 'testnet' | 'mainnet'
  walletConnections: number
  walletsFrom: 'privy' | 'events' | 'none'
  cloudSaves: number
  cloudSavesToday: number
  logouts: number
  deletions: number
}

export type StatRow = { kind: 'row' | 'note' | 'title'; label: string; value?: string }

export function isPublicStats(v: unknown): v is PublicStats {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const nums = [
    'registered', 'signups', 'signIns', 'activeToday', 'agentsRegistered', 'agentsOnline',
    'mintsBase', 'mintsNear', 'walletConnections', 'cloudSaves', 'cloudSavesToday', 'logouts', 'deletions',
  ]
  if (!nums.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))) return false
  if (o.mintsNearNetwork !== 'testnet' && o.mintsNearNetwork !== 'mainnet') return false
  if (o.walletsFrom !== 'privy' && o.walletsFrom !== 'events' && o.walletsFrom !== 'none') return false
  return true
}

const n = (v: number | undefined) => String(Math.max(0, Math.round(Number(v) || 0)))

/** Build the card’s lines. Online now is passed from live presence, not the API. */
export function formatStatsRows(st: PublicStats | null, onlineNow: number): StatRow[] {
  const rows: StatRow[] = [{ kind: 'title', label: 'City stats' }, { kind: 'row', label: 'Online now', value: n(onlineNow) }]
  if (!st) {
    rows.push({ kind: 'note', label: 'Other counts could not load just now. Online now still updates as people arrive.' })
    return rows
  }
  const nearLabel = st.mintsNearNetwork === 'mainnet' ? 'Mints on NEAR' : 'Mints on NEAR testnet'
  rows.push(
    { kind: 'row', label: 'Active today', value: n(st.activeToday) },
    { kind: 'row', label: 'Registered', value: n(st.registered) },
    { kind: 'row', label: 'Sign-ups', value: n(st.signups) },
    { kind: 'row', label: 'Sign-ins', value: n(st.signIns) },
    { kind: 'row', label: 'Agents registered', value: n(st.agentsRegistered) },
    { kind: 'row', label: 'Agents online', value: n(st.agentsOnline) },
    { kind: 'row', label: 'Mints on Base', value: n(st.mintsBase) },
    { kind: 'row', label: nearLabel, value: n(st.mintsNear) },
    { kind: 'row', label: 'Wallet connections', value: n(st.walletConnections) },
    { kind: 'row', label: 'Cloud saves', value: `${n(st.cloudSaves)}  ·  ${n(st.cloudSavesToday)} today` },
    { kind: 'row', label: 'Logouts', value: n(st.logouts) },
    { kind: 'row', label: 'Account deletions', value: n(st.deletions) },
  )
  const bits = ['Sign-ins, logouts and deletions count from this update onward.']
  if (st.walletsFrom === 'privy') bits.push('Wallet connections use linked wallets from sign-in (historical). New browser-only connects are not added on top, so the same person is not counted twice.')
  else if (st.walletsFrom === 'events') bits.push('Wallet connections count from this update (browser connects).')
  else bits.push('Wallet connections will show once a source is available.')
  rows.push({ kind: 'note', label: bits.join(' ') })
  return rows
}
