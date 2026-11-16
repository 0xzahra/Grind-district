// Public aggregate stats for the Online pill. Counts only: no names, emails, or wallet addresses leave this file.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const STATS_EVENT_NAMES = [
  'first_visit', 'session_start', 'signup', 'course_start', 'course_complete', 'cert_shared', 'cert_minted',
  'cv_shared', 'share_click', 'transfer', 'topup_attempt',
  'opened_page', 'guest_play', 'account_created', 'first_lesson',
  'sign_in', 'logout', 'account_deleted', 'wallet_connected',
] as const

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
  /** Learning, counts only: players with at least one course passed, courses passed in all, server certificate
   *  records, and players who saved progress in the last seven days on a later day than they joined. */
  /** Visitors, counts only: browsers that ever opened the game (first_visit fires once per browser), new
   *  ones since midnight Lagos time, and page opens today (session_start, title screen included). */
  visitorsAll?: number
  newVisitorsToday?: number
  visitsToday?: number
  /** Accounts made by signing in with a NEAR wallet (players rows keyed near:<account>). */
  nearAccounts?: number
  learners?: number
  lessonsPassed?: number
  certificates?: number
  returning7d?: number
}

const STATS_TTL_MS = 45_000
const SLOW_TTL_MS = 5 * 60_000
const FETCH_MS = 2_500

type Cache<T> = { at: number; value: T }
let statsCache: Cache<PublicStats> | null = null
let mintCache: Cache<{ base: number; near: number; network: 'testnet' | 'mainnet'; from: 'rpc' | 'events' }> | null = null
let privyCache: Cache<{ users: number; wallets: number } | null> | null = null
type Learning = { learners: number; lessonsPassed: number; certificates: number; returning7d: number }
let learnCache: Cache<Learning | null> | null = null

/** Learning numbers from the synced saves, the certificate records and the visit events. Cached five minutes. */
async function learningStats(db: SupabaseClient): Promise<Learning | null> {
  if (learnCache && Date.now() - learnCache.at < SLOW_TTL_MS) return learnCache.value
  // Three small reads (one row per player, plus a count), so this answers well inside the stats call.
  const [saves, certs, players] = await Promise.all([
    db.from('player_progress').select('privy_user_id, updated_at, skills:save->skills').limit(10000),
    db.from('certificates').select('cert_id', { count: 'exact', head: true }),
    db.from('players').select('privy_user_id, created_at').limit(10000),
  ])
  if (saves.error && certs.error) { learnCache = { at: Date.now(), value: null }; return null }
  const joined = new Map<string, number>()
  for (const p of (players.data ?? []) as Array<{ privy_user_id?: string; created_at?: string }>) if (p.privy_user_id && p.created_at) joined.set(p.privy_user_id, Date.parse(p.created_at))
  const weekAgo = Date.now() - 7 * 86_400_000
  let learners = 0, lessonsPassed = 0, returning7d = 0
  for (const row of (saves.data ?? []) as Array<{ privy_user_id?: string; updated_at?: string; skills?: Record<string, { passed?: boolean } | null> | null }>) {
    const n = Object.values(row.skills ?? {}).filter((x) => x?.passed === true).length
    if (n > 0) { learners += 1; lessonsPassed += n }
    // Came back: progress saved in the last seven days, on a later day than the account was made.
    const seen = Date.parse(String(row.updated_at ?? '')), made = joined.get(String(row.privy_user_id ?? ''))
    if (Number.isFinite(seen) && made !== undefined && seen >= weekAgo && lagosDayStart(seen) !== lagosDayStart(made)) returning7d += 1
  }
  const value = { learners, lessonsPassed, certificates: count(certs), returning7d }
  learnCache = { at: Date.now(), value }
  return value
}

const TIGHT_EVENTS = new Set(['sign_in', 'logout', 'account_deleted', 'wallet_connected', 'account_created'])
const TIGHT_KEYS = new Set(['via', 'source'])

export function publicEventProps(name: string, props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (/user|email|address|wallet|username|privy/i.test(k) && k !== 'via') continue
    if (TIGHT_EVENTS.has(name) && !TIGHT_KEYS.has(k)) continue
    if (typeof v === 'string') out[k] = v.slice(0, 80)
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

export function lagosDayStart(nowMs = Date.now()): string {
  const now = new Date(nowMs + 3_600_000)
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3_600_000).toISOString()
}

function dbClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } })
}

const count = (r: { count: number | null } | { count?: number | null }) => r.count ?? 0

export async function insertAnalyticsEvent(db: SupabaseClient, name: (typeof STATS_EVENT_NAMES)[number], props: Record<string, unknown> = {}): Promise<void> {
  // Never put identities in props. Callers must already have stripped them.
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (/user|email|address|wallet|name|id/i.test(k)) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') clean[k] = typeof v === 'string' ? v.slice(0, 40) : v
  }
  const { error } = await db.from('events').insert({ name, anon_id: '', session_id: '', props: clean, client_at: new Date().toISOString() })
  if (error) throw error
}

async function eventCount(db: SupabaseClient, name: string): Promise<number> {
  const r = await db.from('events').select('id', { count: 'exact', head: true }).eq('name', name)
  return count(r)
}

async function eventCountSince(db: SupabaseClient, name: string, since: string): Promise<number | null> {
  const r = await db.from('events').select('id', { count: 'exact', head: true }).eq('name', name).gte('created_at', since)
  return r.error ? null : count(r)
}

async function uniqueActiveToday(db: SupabaseClient, since: string): Promise<number> {
  const r = await db.from('events').select('anon_id').gte('created_at', since).in('name', ['session_start', 'first_visit', 'sign_in']).limit(5000)
  return new Set((r.data ?? []).map((row) => String((row as { anon_id?: string }).anon_id ?? '')).filter(Boolean)).size
}

async function mintEventsByChain(db: SupabaseClient): Promise<{ base: number; near: number }> {
  const r = await db.from('events').select('props').eq('name', 'cert_minted').limit(5000)
  let base = 0, near = 0
  for (const row of r.data ?? []) {
    const chain = String((row as { props?: { chain?: string } }).props?.chain ?? '')
    if (chain === 'base') base += 1
    else if (chain === 'near') near += 1
  }
  return { base, near }
}

async function timeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

async function baseTotalSupply(contract: string): Promise<number | null> {
  try {
    const r = await timeout(fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: contract, data: '0x18160ddd' }, 'latest'] }),
    }), FETCH_MS)
    if (!r || !r.ok) return null
    const j = await r.json() as { result?: string }
    if (!j.result || j.result === '0x') return null
    const n = Number(BigInt(j.result))
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function nearTotalSupply(contract: string): Promise<number | null> {
  try {
    const r = await timeout(fetch('https://rpc.testnet.near.org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'nft_total_supply', args_base64: 'e30=' } }),
    }), FETCH_MS)
    if (!r || !r.ok) return null
    const j = await r.json() as { result?: { result?: number[] } }
    const bytes = j.result?.result
    if (!bytes?.length) return null
    const n = Number(JSON.parse(Buffer.from(bytes).toString('utf8')))
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function chainMints(db: SupabaseClient): Promise<{ base: number; near: number; network: 'testnet' | 'mainnet'; from: 'rpc' | 'events' }> {
  if (mintCache && Date.now() - mintCache.at < SLOW_TTL_MS) return mintCache.value
  const baseAddr = (process.env.VITE_CERT_NFT_BASE ?? '').trim()
  const nearId = (process.env.VITE_CERT_NFT_NEAR ?? '').trim()
  const network: 'testnet' | 'mainnet' = nearId.endsWith('.near') ? 'mainnet' : 'testnet'
  const [rpcBase, rpcNear, ev] = await Promise.all([
    baseAddr ? baseTotalSupply(baseAddr) : Promise.resolve(null),
    nearId ? nearTotalSupply(nearId) : Promise.resolve(null),
    mintEventsByChain(db),
  ])
  // On-chain is the source of truth. Event counts are only a fallback when an RPC read fails, never added on top.
  const value = {
    base: rpcBase ?? ev.base,
    near: rpcNear ?? ev.near,
    network,
    from: (rpcBase == null && rpcNear == null ? 'events' : 'rpc') as 'rpc' | 'events',
  }
  mintCache = { at: Date.now(), value }
  return value
}

async function privyCounts(): Promise<{ users: number; wallets: number } | null> {
  if (privyCache && Date.now() - privyCache.at < SLOW_TTL_MS) return privyCache.value
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET
  if (!appId || !secret) {
    privyCache = { at: Date.now(), value: null }
    return null
  }
  try {
    const auth = Buffer.from(`${appId}:${secret}`).toString('base64')
    const headers = { authorization: `Basic ${auth}`, 'privy-app-id': appId }
    const hosts = ['https://api.privy.io/v1/users', 'https://auth.privy.io/api/v1/users']
    let host = hosts[0]
    let cursor = ''
    let users = 0
    const wallets = new Set<string>()
    for (let page = 0; page < 20; page++) {
      const url = new URL(host)
      url.searchParams.set('limit', '100')
      if (cursor) url.searchParams.set('cursor', cursor)
      const r = await timeout(fetch(url, { headers }), FETCH_MS)
      if ((!r || !r.ok) && page === 0 && host === hosts[0]) { host = hosts[1]; page -= 1; continue }
      if (!r || !r.ok) break
      const j = await r.json() as { data?: Array<{ linked_accounts?: Array<{ type?: string; address?: string }>; linkedAccounts?: Array<{ type?: string; address?: string }> }>; next_cursor?: string | null }
      const batch = j.data ?? []
      users += batch.length
      for (const u of batch) {
        for (const a of u.linked_accounts ?? u.linkedAccounts ?? []) {
          if (a.type === 'wallet' && a.address) wallets.add(a.address.toLowerCase())
        }
      }
      if (!j.next_cursor || !batch.length) break
      cursor = j.next_cursor
    }
    const value = { users, wallets: wallets.size }
    wallets.clear()
    privyCache = { at: Date.now(), value }
    return value
  } catch {
    privyCache = { at: Date.now(), value: null }
    return null
  }
}

export async function collectPublicStats(): Promise<PublicStats | { error: string; status: number }> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'not configured', status: 503 }
  const db = dbClient(url, key)
  const since = lagosDayStart()
  const fiveMin = new Date(Date.now() - 5 * 60_000).toISOString()
  const [
    players, agentsRegistered, agentsOnline, saves, savesToday, signIns, logouts, deletions,
    walletEvents, activeToday, mints, privy, learning, nearPlayers, visitorsAll, newVisitorsToday, visitsToday,
  ] = await Promise.all([
    db.from('players').select('id', { count: 'exact', head: true }),
    db.from('agents').select('id', { count: 'exact', head: true }),
    db.from('agents').select('id', { count: 'exact', head: true }).gte('last_seen', fiveMin),
    db.from('player_progress').select('privy_user_id', { count: 'exact', head: true }),
    db.from('player_progress').select('privy_user_id', { count: 'exact', head: true }).gte('updated_at', since),
    eventCount(db, 'sign_in'),
    eventCount(db, 'logout'),
    eventCount(db, 'account_deleted'),
    eventCount(db, 'wallet_connected'),
    uniqueActiveToday(db, since),
    chainMints(db),
    privyCounts(),
    timeout(learningStats(db).catch(() => null), FETCH_MS * 2),
    db.from('players').select('id', { count: 'exact', head: true }).like('privy_user_id', 'near:%'),
    eventCountSince(db, 'first_visit', '2000-01-01T00:00:00Z'),
    eventCountSince(db, 'first_visit', since),
    eventCountSince(db, 'session_start', since),
  ])
  const registered = count(players)
  // Sign-ups = current game accounts plus deletions recorded from this update on (ever-created, as far as we can see).
  const signups = registered + deletions
  // Wallet connections: Privy linked wallets have history. Browser-connect events would double-count the same people, so they are not added on top.
  let walletConnections = 0
  let walletsFrom: PublicStats['walletsFrom'] = 'none'
  if (privy && privy.wallets > 0) {
    walletConnections = privy.wallets
    walletsFrom = 'privy'
  } else if (walletEvents > 0) {
    walletConnections = walletEvents
    walletsFrom = 'events'
  } else if (privy) {
    walletConnections = privy.wallets
    walletsFrom = 'privy'
  }
  const value: PublicStats = {
    registered,
    signups,
    signIns,
    activeToday,
    agentsRegistered: count(agentsRegistered),
    agentsOnline: count(agentsOnline),
    mintsBase: mints.base,
    mintsNear: mints.near,
    mintsNearNetwork: mints.network,
    walletConnections,
    walletsFrom,
    cloudSaves: count(saves),
    cloudSavesToday: count(savesToday),
    logouts,
    deletions,
    ...(learning ?? {}),
    ...(nearPlayers.error ? {} : { nearAccounts: count(nearPlayers) }),
    ...(visitorsAll == null ? {} : { visitorsAll }),
    ...(newVisitorsToday == null ? {} : { newVisitorsToday }),
    ...(visitsToday == null ? {} : { visitsToday }),
  }
  statsCache = { at: Date.now(), value }
  return value
}

/** Drop cached totals after a deletion (or any write) so the next pill open is fresh. */
export function bustStatsCache(): void {
  statsCache = null
}
