// Optional NEAR testnet Skill Passport. Independent of Privy/Base/guest: nothing here touches the save,
// ledger or login. A record is SELF-ATTESTED (written by the player's own NEAR account), never accredited.
// The quest unlock comes only from a real read of the contract, never from local state.
import type { SkillId } from './logic.ts'

export const NEAR_CONTRACT = (import.meta.env.VITE_NEAR_PASSPORT_CONTRACT ?? '') as string
const RPC = (import.meta.env.VITE_NEAR_RPC ?? 'https://rpc.testnet.near.org') as string
const EXPLORER = 'https://testnet.nearblocks.io/txns/'
// Both must be set: VITE_NEAR_PASSPORT=1 and a public *.testnet contract ID. Testnet only, never mainnet.
export const nearPassportOn = (): boolean => import.meta.env.VITE_NEAR_PASSPORT === '1' && /^[a-z0-9._-]+\.testnet$/.test(NEAR_CONTRACT)

type Completion = { course_id: string; version: number; completed_at_ms: number }

async function view<T>(method: string, args: object): Promise<T> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000)
  try {
    const res = await fetch(RPC, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: NEAR_CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) })
    const j = await res.json()
    if (!res.ok || j.error || !j.result?.result) throw new Error('rpc')
    return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))) as T
  } finally { clearTimeout(t) }
}
export const readCompletion = (account: string, course: SkillId) => view<Completion | null>('get_completion', { account_id: account, course_id: course })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connectorP: Promise<any> | null = null
const connector = () => (connectorP ??= import('@hot-labs/near-connect').then(({ NearConnector }) => new NearConnector({ network: 'testnet', features: { signAndSendTransaction: true } })))
async function currentAccount(): Promise<string> {
  try { const w = await (await connector()).wallet(); const a = await w.getAccounts(); return a[0]?.accountId ?? '' } catch { return '' }
}

const QUESTS: Partial<Record<SkillId, string>> = { spot: 'Trading desk apprentice: log one sized practice trade with a stop on the spot desk.' }
const questFor = (id: SkillId) => QUESTS[id] ?? 'Apprentice task: teach this course’s main idea to one citizen on Campus.'

/** Panel for a passed course. Guest/Privy players can ignore it; nothing changes unless they connect. */
export function nearPassportPanel(course: SkillId, passed: boolean): HTMLElement {
  const box = document.createElement('div'); box.className = 'near-pass'
  box.style.cssText = 'border:1px solid #3f5f7f;border-radius:10px;padding:10px;margin:10px 0;font-size:14px'
  const title = document.createElement('p'); title.style.fontWeight = '700'; title.textContent = 'NEAR Skill Passport (testnet, optional)'
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Self-attested: your own NEAR testnet account writes this record. It is not graded or accredited. No tokens, no payments.'
  const status = document.createElement('p'); status.setAttribute('role', 'status')
  const act = document.createElement('div')
  box.append(title, note, status, act)
  const btn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.className = 'primary'; b.textContent = label; b.onclick = fn; return b }
  let busy = false // a tap on Connect/Save owns the panel; the background wallet check never overwrites it
  const set = (msg: string, ...buttons: HTMLElement[]) => { status.textContent = msg; act.replaceChildren(...buttons) }

  const showConfirmed = (account: string, c: Completion, tx?: string) => {
    set(`Confirmed on NEAR testnet for ${account}: ${course} v${c.version}, ${new Date(c.completed_at_ms).toLocaleString()}.`)
    if (tx) { const a = document.createElement('a'); a.href = EXPLORER + tx; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'View transaction'; act.append(a) }
    const q = document.createElement('p'); q.style.fontWeight = '700'; q.textContent = 'Quest unlocked · ' + questFor(course); act.append(q)
  }
  const check = async (account: string, tx?: string) => {
    set('Reading your passport from NEAR testnet…')
    try {
      const c = await readCompletion(account, course)
      if (c) return showConfirmed(account, c, tx)
      if (!passed) return set(`Connected as ${account}. Pass this course first, then save it here.`)
      set(`Connected as ${account}. Not saved yet.`, btn('Save self-attested record (wallet will ask)', () => void save(account)))
    } catch { set('Could not reach NEAR testnet. Nothing was changed. Try again.', btn('Retry', () => void check(account, tx))) }
  }
  const save = async (account: string) => {
    busy = true
    if (!passed) return set('Pass this course first, then save it here.')
    set('Waiting for your wallet to approve…')
    try {
      const w = await (await connector()).wallet()
      const out = await w.signAndSendTransaction({ receiverId: NEAR_CONTRACT, actions: [{ type: 'FunctionCall', params: { methodName: 'record_completion', args: { course_id: course, version: 1 }, gas: '30000000000000', deposit: '0' } }] })
      const failed = out?.status && typeof out.status === 'object' && 'Failure' in out.status
      if (failed) return set('The contract rejected the record. Nothing was saved.', btn('Try again', () => void check(account)))
      await check(account, out?.transaction?.hash)
    } catch { set('Not saved: the wallet request was rejected or failed. You can try again.', btn('Try again', () => void check(account))) }
  }
  const connect = async () => {
    busy = true
    set('Opening NEAR wallets…')
    try { const w = await (await connector()).connect(); const a = (await w.getAccounts())[0]?.accountId; if (!a) throw new Error('no account'); await check(a) }
    catch { set('Not connected. Your game and save are unchanged.', btn('Connect NEAR testnet wallet', () => void connect())) }
  }
  // Show a working button at once; the wallet library loads in the background (it was a blank wait on phones).
  set('', btn('Connect NEAR testnet wallet', () => void connect()))
  void currentAccount().then((a) => { if (a && !busy) void check(a) })
  return box
}

/** Menu page: explains the optional NEAR testnet passport. Open to guests; learning never needs a wallet. */
export function nearPassportPage(passedIds: SkillId[], titleOf: (id: SkillId) => string): HTMLElement {
  const w = document.createElement('div')
  const p = (t: string) => { const n = document.createElement('p'); n.textContent = t; return n }
  w.append(
    p('Optional and separate from your game sign-in. Your game account (guest or email sign-in) keeps your save. A NEAR testnet wallet is only for writing a self-attested course record on NEAR testnet. No real money, no tokens, and we never ask for a seed phrase.'),
  )
  const ol = document.createElement('ol')
  for (const t of ['Pass a course: Play, walk to Campus (or open Career > Lessons from the menu) and pass its exercises.', 'Connect a NEAR testnet wallet here or on the passed course page.', 'Save the record. Your wallet asks you to approve. The game then reads it back from NEAR and unlocks an apprenticeship quest.']) { const li = document.createElement('li'); li.textContent = t; ol.append(li) }
  w.append(ol, p(`Contract: ${NEAR_CONTRACT} (NEAR testnet)`))
  if (!passedIds.length) {
    // No passed course on this device: no wallet panel and no save button at all. Pass first.
    w.append(p('You have not passed a course on this device yet. Start with Spot trading on Campus; the passport option appears here after you pass.'))
  } else for (const id of passedIds) { w.append(p(titleOf(id))); w.append(nearPassportPanel(id, true)) }
  return w
}
