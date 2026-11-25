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
  visitorsAll?: number
  newVisitorsToday?: number
  visitsToday?: number
  nearAccounts?: number
  learners?: number
  lessonsPassed?: number
  certificates?: number
  returning7d?: number
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
  // Visitors, all time leads (it is the number on the pill); Online now is who is in the city this minute.
  const rows: StatRow[] = [{ kind: 'title', label: 'City stats' }]
  if (st && typeof st.visitorsAll === 'number') rows.push({ kind: 'row', label: 'Visitors, all time', value: n(st.visitorsAll) })
  if (st) rows.push({ kind: 'row', label: 'Active today', value: n(Math.max(st.activeToday, onlineNow)) })
  rows.push({ kind: 'row', label: 'Online now', value: n(onlineNow) })
  // Visitors: everyone who opens the game, signed up or not. "Today" starts at midnight Lagos time.
  if (st && typeof st.visitsToday === 'number') rows.push({ kind: 'row', label: 'Visits today (game opened)', value: n(st.visitsToday) })
  if (st && typeof st.newVisitorsToday === 'number') rows.push({ kind: 'row', label: 'New visitors today', value: n(st.newVisitorsToday) })
  if (!st) {
    rows.push({ kind: 'note', label: 'Other counts could not load just now. Online now still updates as people arrive.' })
    return rows
  }
  const nearLabel = st.mintsNearNetwork === 'mainnet' ? 'Mints on NEAR' : 'Mints on NEAR testnet'
  rows.push(
    ...(typeof st.learners === 'number' ? [
      { kind: 'row' as const, label: 'Learners (passed a course)', value: n(st.learners) },
      { kind: 'row' as const, label: 'Courses passed', value: n(st.lessonsPassed) },
      { kind: 'row' as const, label: 'Certificates issued', value: n(st.certificates) },
      { kind: 'row' as const, label: 'Came back on another day (7 days)', value: n(st.returning7d) },
    ] : []),
    { kind: 'row', label: 'Registered', value: n(st.registered) },
    { kind: 'row', label: 'Sign-ups', value: n(st.signups) },
    ...(typeof st.nearAccounts === 'number' ? [{ kind: 'row' as const, label: 'Signed up with a NEAR wallet', value: n(st.nearAccounts) }] : []),
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
  const bits = ['Today counts from midnight Lagos time (WAT), so the day\'s numbers start low each morning. Active today is people who opened the game today; Visitors count each browser once.', 'Sign-ins, logouts and deletions count from this update onward.']
  if (st.walletsFrom === 'privy') bits.push('Wallet connections use linked wallets from sign-in (historical). New browser-only connects are not added on top, so the same person is not counted twice.')
  else if (st.walletsFrom === 'events') bits.push('Wallet connections count from this update (browser connects).')
  else bits.push('Wallet connections will show once a source is available.')
  rows.push({ kind: 'note', label: bits.join(' ') })
  return rows
}

export type StatTile = { label: string; value: string }
export type StatCard = { online: string; hero: StatTile[]; sections: Array<{ title: string; tiles: StatTile[] }>; note: string | null }

/** The same numbers as formatStatsRows, laid out as a card: three headline figures, then short sections of tiles. */
export function statsCard(st: PublicStats | null, onlineNow: number): StatCard {
  const k = (v: number | undefined) => { const x = Math.max(0, Math.round(Number(v) || 0)); return x >= 10000 ? `${(x / 1000).toFixed(x >= 100000 ? 0 : 1)}k` : x.toLocaleString('en-US') }
  const hero: StatTile[] = [{ label: 'Online now', value: k(onlineNow) }]
  if (st) hero.push({ label: 'Active today', value: k(Math.max(st.activeToday, onlineNow)) })
  if (st && typeof st.visitorsAll === 'number') hero.push({ label: 'Visitors', value: k(st.visitorsAll) })
  if (!st) return { online: k(onlineNow), hero, sections: [], note: 'Other counts could not load just now. Online now still updates as people arrive.' }
  const sections: StatCard['sections'] = []
  const today: StatTile[] = []
  if (typeof st.visitsToday === 'number') today.push({ label: 'Visits today', value: k(st.visitsToday) })
  if (typeof st.newVisitorsToday === 'number') today.push({ label: 'New today', value: k(st.newVisitorsToday) })
  if (today.length) sections.push({ title: 'Today', tiles: today })
  if (typeof st.learners === 'number') sections.push({ title: 'Learning', tiles: [
    { label: 'Learners', value: k(st.learners) }, { label: 'Courses passed', value: k(st.lessonsPassed) },
    { label: 'Certificates', value: k(st.certificates) }, { label: 'Back in 7 days', value: k(st.returning7d) },
  ] })
  sections.push({ title: 'Players', tiles: [
    { label: 'Registered', value: k(st.registered) }, { label: 'Sign-ups', value: k(st.signups) },
    ...(typeof st.nearAccounts === 'number' ? [{ label: 'NEAR sign-ups', value: k(st.nearAccounts) }] : []),
    { label: 'Sign-ins', value: k(st.signIns) },
  ] })
  sections.push({ title: 'On-chain and agents', tiles: [
    { label: 'Mints · Base', value: k(st.mintsBase) }, { label: st.mintsNearNetwork === 'mainnet' ? 'Mints · NEAR' : 'Mints · NEAR test', value: k(st.mintsNear) },
    { label: 'Wallets linked', value: k(st.walletConnections) }, { label: 'Agents', value: `${k(st.agentsOnline)} / ${k(st.agentsRegistered)}` },
  ] })
  sections.push({ title: 'Saves', tiles: [
    { label: 'Cloud saves', value: k(st.cloudSaves) }, { label: 'Saved today', value: k(st.cloudSavesToday) },
    { label: 'Logouts', value: k(st.logouts) }, { label: 'Deletions', value: k(st.deletions) },
  ] })
  const notes = formatStatsRows(st, onlineNow).filter((r) => r.kind === 'note').map((r) => r.label)
  return { online: k(onlineNow), hero, sections, note: [...notes, 'Agents: online now / registered.'].join(' ') }
}
