// Certificate NFTs that do something in the game. A course certificate minted on NEAR (the soulbound NEP-171
// contract in VITE_CERT_NFT_NEAR, e.g. grinddistrict-cert.testnet) is read back from the chain, never trusted
// from local state, and then:
//   - marks that course "Verified on NEAR" on the CV, the profile and the certificate list, with the token link;
//   - works as a membership pass: the Holders' suite in the Members' lounge opens only for players whose
//     username holds at least one certificate token, and its desks give holders tools the lounge keeps for
//     higher ranks.
// Read-only NEAR RPC view calls (cert_for). Nothing here writes to the save, the ledger or the account.
import { getSave } from './state.ts'
import { SKILL_META, SKILL_ORDER, type SkillId } from './logic.ts'

const NFT = String(import.meta.env.VITE_CERT_NFT_NEAR ?? '')
export const certNftOn = (): boolean => /^[a-z0-9._-]{2,64}$/.test(NFT)
const TESTNET = NFT.endsWith('.testnet')
const RPC = TESTNET ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org'
const EXPLORER = TESTNET ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io'
export const certNftNetwork = TESTNET ? 'NEAR testnet' : 'NEAR'
export const certNftContract = NFT

export type HeldCert = { course: SkillId; title: string; tokenId: string; owner: string; explorer: string }
type Token = { token_id: string; owner_id: string; certificate?: { username?: string; course_id?: string } } | null

async function view<T>(method: string, args: object): Promise<T> {
  const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(RPC, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: NFT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) })
    const j = await r.json()
    if (!r.ok || j.error || !j.result?.result) throw new Error('NEAR RPC error')
    return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))) as T
  } finally { window.clearTimeout(t) }
}

const FRESH_MS = 5 * 60_000
let cache: { user: string; at: number; held: HeldCert[] } | null = null
let inflight: { user: string; p: Promise<HeldCert[]> } | null = null

/** Certificates the signed-in player holds on NEAR, read from the chain (cached for five minutes). */
export function certNfts(force = false): Promise<HeldCert[]> {
  const s = getSave(), user = s.username
  if (!certNftOn() || !user) return Promise.resolve([])
  if (!force && cache?.user === user && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.held)
  if (inflight?.user === user) return inflight.p
  // Only passed courses can have been minted (the game signs a mint voucher only for a pass).
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  const p = (async () => {
    const held: HeldCert[] = []
    let next = 0, reached = false
    const worker = async () => {
      while (next < passed.length) {
        const course = passed[next++]!
        try {
          const t = await view<Token>('cert_for', { username: user, course_id: course })
          reached = true
          if (t && (t.certificate?.username ?? user) === user && (t.certificate?.course_id ?? course) === course) {
            held.push({ course, title: SKILL_META[course].title, tokenId: t.token_id, owner: t.owner_id, explorer: `${EXPLORER}/nft-token/${NFT}/${t.token_id}` })
          }
        } catch { /* one failed lookup does not hide the others */ }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    if (!reached && passed.length) throw new Error('Could not reach NEAR')
    held.sort((a, b) => SKILL_ORDER.indexOf(a.course) - SKILL_ORDER.indexOf(b.course))
    cache = { user, at: Date.now(), held }
    return held
  })().finally(() => { if (inflight?.p === p) inflight = null })
  inflight = { user, p }
  return p
}

/** What the last chain read found, without waiting (empty until a read has finished). */
export const heldNow = (): HeldCert[] => (cache?.user === getSave().username ? cache.held : [])

const tag = (h: HeldCert, label = `Verified on NEAR · #${h.tokenId}`): HTMLAnchorElement => {
  const a = document.createElement('a')
  a.className = 'nft-ok'
  a.href = h.explorer; a.target = '_blank'; a.rel = 'noopener noreferrer'
  a.textContent = label
  a.title = `Token #${h.tokenId} on ${certNftContract}, owned by ${h.owner}`
  a.addEventListener('click', (e) => e.stopPropagation())
  return a
}

/** After a chain read, add "Verified on NEAR" marks inside `root`: on every element with data-course set to a
 *  held course, under the profile nameplate, and as an on-chain credentials entry on the CV page. */
export async function markVerified(root: HTMLElement): Promise<void> {
  if (!certNftOn() || !getSave().username) return
  const held = await certNfts().catch(() => [] as HeldCert[])
  if (!held.length || !root.isConnected) return
  const by = new Map(held.map((h) => [h.course, h]))
  root.querySelectorAll<HTMLElement>('[data-course]').forEach((el) => {
    const h = by.get(el.dataset.course as SkillId)
    if (h && !el.querySelector('.nft-ok')) el.append(tag(h, el.classList.contains('cv-item') ? `Verified on NEAR · token #${h.tokenId}` : '✓ NEAR'))
  })
  const plate = root.querySelector<HTMLElement>('.nameplate')
  if (plate && !plate.querySelector('.nft-badge')) {
    const b = document.createElement('span')
    b.className = 'nft-badge'
    b.textContent = `✓ Verified on NEAR · ${held.length} certificate${held.length === 1 ? '' : 's'}`
    plate.append(b)
  }
  const edu = root.querySelector<HTMLElement>('.cv-paper [data-sec="edu"]')
  if (edu && !edu.querySelector('[data-onchain]')) {
    const row = document.createElement('div'); row.className = 'cv-item'; row.dataset.onchain = '1'
    const top = document.createElement('div'); top.className = 'cv-item-top'
    const name = document.createElement('strong'); name.textContent = 'On-chain credentials'
    const when = document.createElement('span'); when.className = 'cv-when'; when.textContent = `${held.length} verified`
    top.append(name, when)
    const where = document.createElement('em'); where.textContent = `Soulbound certificate NFTs on ${certNftNetwork} (${certNftContract})`
    const ul = document.createElement('ul')
    for (const h of held) { const li = document.createElement('li'); li.append(`${h.title} · `, tag(h, `token #${h.tokenId}`)); ul.append(li) }
    row.append(top, where, ul)
    edu.append(row)
  }
}
