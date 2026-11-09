import { applyTopup } from './state.ts'

const WALLET_KEY = 'gd.topup.wallet'
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
const savedFrom = () => { try { const s = localStorage.getItem(WALLET_KEY) ?? ''; return isAddr(s) ? s : '' } catch { return '' } }

export async function syncTopups(player: string, onChange: () => void): Promise<void> {
  try {
    const r = await fetch(`/api/topup-confirm?player=${player}`)
    if (!r.ok) return
    const { topups } = (await r.json()) as { topups: Array<{ hash: string; credit: number; asset: string }> }
    let changed = false
    for (const t of topups) changed = applyTopup(t.hash, t.credit, t.asset) || changed
    if (changed) onChange()
  } catch { /* offline */ }
}

export async function autoSyncTopups(onChange: () => void): Promise<void> {
  const a = savedFrom()
  if (a) await syncTopups(a.toLowerCase(), onChange)
}
