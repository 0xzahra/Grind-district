// Online pill stats: public counts only, honest empty history, and the API event allowlist.
import { formatStatsRows, isPublicStats, type PublicStats } from '../src/statsPanel.ts'
import { STATS_EVENT_NAMES, lagosDayStart, publicEventProps } from '../api/_stats.ts'

const sample: PublicStats = {
  registered: 22,
  signups: 22,
  signIns: 0,
  activeToday: 58,
  agentsRegistered: 5,
  agentsOnline: 0,
  mintsBase: 0,
  mintsNear: 2,
  mintsNearNetwork: 'testnet',
  walletConnections: 3,
  walletsFrom: 'privy',
  cloudSaves: 21,
  cloudSavesToday: 10,
  logouts: 0,
  deletions: 0,
}

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

check(isPublicStats(sample), 'valid stats pass')
check(!isPublicStats({ registered: 22, activeToday: 58, agentsOnline: 0 }), 'old three-field payload is not enough')
check(!isPublicStats({ ...sample, registered: '22' }), 'string counts are rejected')
check(!isPublicStats(null), 'null is rejected')

const rows = formatStatsRows(sample, 4)
const labels = rows.filter((r) => r.kind === 'row').map((r) => r.label)
const by = Object.fromEntries(rows.filter((r) => r.kind === 'row').map((r) => [r.label, r.value]))
check(rows[0]?.kind === 'title' && rows[0].label === 'City stats', 'title')
check(by['Online now'] === '4', 'live presence is used for online now, not the API')
check(by['Active today'] === '58', 'active today')
check(by['Registered'] === '22', 'registered')
check(by['Sign-ups'] === '22', 'sign-ups')
check(by['Sign-ins'] === '0', 'sign-ins can be zero (counted from this update)')
check(by['Agents registered'] === '5' && by['Agents online'] === '0', 'agents split')
check(by['Mints on Base'] === '0', 'base mints')
check(by['Mints on NEAR testnet'] === '2', 'NEAR is labelled testnet')
check(!labels.includes('Mints on NEAR'), 'do not hide the testnet label')
check(by['Wallet connections'] === '3', 'wallets')
check(by['Cloud saves'] === '21  ·  10 today', 'cloud saves total + today')
check(by['Logouts'] === '0' && by['Account deletions'] === '0', 'logout and deletion start at zero')
const note = rows.find((r) => r.kind === 'note')?.label ?? ''
check(/from this update/i.test(note), 'honest about new counters')
check(/not counted twice/i.test(note), 'privy wallet note mentions dedupe')
check(!/0x|@|\.near|did:privy/i.test(JSON.stringify(rows)), 'no identities in the card')

const fallback = formatStatsRows(null, 1)
check(fallback.some((r) => r.kind === 'row' && r.label === 'Online now' && r.value === '1'), 'online now still shows when the API fails')
check(fallback.some((r) => r.kind === 'note' && /could not load/i.test(r.label)), 'load failure is honest')

const needed = ['sign_in', 'logout', 'account_deleted', 'wallet_connected', 'account_created', 'cert_minted']
for (const name of needed) check((STATS_EVENT_NAMES as readonly string[]).includes(name), `allowlist has ${name}`)

const start = new Date(lagosDayStart(Date.parse('2026-11-14T14:20:00Z'))).toISOString()
check(start === '2026-11-13T23:00:00.000Z', `Lagos day start, got ${start}`)

const tight = publicEventProps('sign_in', { via: 'privy', userId: 'did:privy:secret', email: 'a@b.c', username: 'reef' })
check(tight.via === 'privy' && !('userId' in tight) && !('email' in tight) && !('username' in tight), 'sign-in props keep via only')
const visit = publicEventProps('first_visit', { src: 'invite', utm_source: 'x' })
check(visit.src === 'invite' && visit.utm_source === 'x', 'existing attribution props stay')

console.log('ok - city stats panel, allowlist and Lagos day')

