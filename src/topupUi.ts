// Look and feel of the top-up sheet only: chain logos, step headings, the "How this works" fold and the
// waiting / credited / refunded status pill. Nothing here touches payments, amounts, fees or addresses.

export type ChainId = 'base' | 'near' | 'solana' | 'any'

// Small round badges drawn inline (no image requests). Fixed strings, never player text.
const LOGOS: Record<string, string> = {
  base: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0052ff"/><circle cx="16" cy="16" r="10.5" fill="#fff"/><rect x="15" y="14.2" width="12" height="3.6" fill="#0052ff"/></svg>',
  near: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0b0b0c"/><path fill="#fff" d="M21.9 8.6 17.8 14.700c-.3.4.2.9.6.500l4-3.500c.1-.1.3 0 .3.200v11c0 .2-.3.3-.4.100L9.8 8.100c-.4-.5-1-.8-1.7-.8h-.5c-1.1 0-2 .9-2 2v13.600c0 1.1.9 2 2 2 .7 0 1.4-.4 1.7-1l4.1-6.100c.3-.4-.2-.9-.6-.5l-4 3.500c-.1.1-.3 0-.3-.2v-11c0-.2.3-.3.4-.1l12.5 14.900c.4.5 1 .8 1.6.8h.5c1.1 0 2-.9 2-2V9.200c0-1.1-.9-2-2-2-.7 0-1.3.4-1.7 1.400Z" transform="translate(3.4 3.2) scale(.78)"/></svg>',
  solana: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="tpsol" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="#15121f"/><g fill="url(#tpsol)"><path d="M9.6 20.100c.1-.1.3-.2.5-.2h13.600c.3 0 .5.4.3.600l-2.6 2.600c-.1.1-.3.2-.5.200H7.300c-.3 0-.5-.400-.3-.600l2.6-2.600Z"/><path d="M9.6 9.100c.1-.1.3-.2.5-.2h13.600c.3 0 .5.4.3.600l-2.6 2.600c-.1.1-.3.2-.5.200H7.300c-.3 0-.5-.400-.3-.600l2.6-2.600Z"/><path d="M21.1 14.500c-.1-.1-.3-.2-.5-.2H7c-.3 0-.5.4-.3.600l2.6 2.600c.1.1.3.2.5.200h13.600c.3 0 .5-.400.3-.600l-2.6-2.600Z"/></g></svg>',
  any: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="tpany" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5dfc"/><stop offset="1" stop-color="#22c3e6"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="url(#tpany)"/><g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><ellipse cx="16" cy="16" rx="10" ry="4.2" transform="rotate(-28 16 16)"/><ellipse cx="16" cy="16" rx="10" ry="4.2" transform="rotate(28 16 16)"/></g><circle cx="16" cy="16" r="3.2" fill="#fff"/></svg>',
  // coins
  usdc: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#2775ca"/><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" d="M19.6 12.400c-.4-1.3-1.7-2-3.6-2-2 0-3.5.9-3.5 2.6 0 3.6 7.2 1.6 7.2 5.3 0 1.7-1.6 2.7-3.7 2.7-2 0-3.5-.8-3.9-2.200M16 8v2.400m0 11.200V24"/></svg>',
  eth: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#3c3c3d"/><path fill="#fff" d="m16 5.5 6 10.2-6 3.5-6-3.5 6-10.200Z"/><path fill="#c9ccd6" d="m16 20.5 6-3.5-6 9.5-6-9.5 6 3.500Z"/></svg>',
  sol: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#15121f"/><g fill="#14f195"><path d="M9.6 20.100c.1-.1.3-.2.5-.2h13.600c.3 0 .5.4.3.600l-2.6 2.600c-.1.1-.3.2-.5.200H7.300c-.3 0-.5-.400-.3-.600l2.6-2.600Z"/><path d="M9.6 9.100c.1-.1.3-.2.5-.2h13.600c.3 0 .5.4.3.600l-2.6 2.600c-.1.1-.3.2-.5.200H7.300c-.3 0-.5-.400-.3-.600l2.6-2.600Z"/><path d="M21.1 14.500c-.1-.1-.3-.2-.5-.2H7c-.3 0-.5.4-.3.600l2.6 2.600c.1.1.3.2.5.200h13.600c.3 0 .5-.400.3-.600l-2.6-2.600Z"/></g></svg>',
  coin: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#6b7280"/><circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="2"/></svg>',
}

/** A round logo badge for a chain ('base', 'near', 'solana', 'any') or a coin ('usdc', 'eth', 'sol'). */
export function logo(id: string, cls = 'tp-logo'): HTMLSpanElement {
  const s = document.createElement('span')
  s.className = cls
  s.setAttribute('aria-hidden', 'true')
  s.innerHTML = LOGOS[id.toLowerCase()] ?? LOGOS.coin!
  return s
}

/** Coin name ("USDC", "ETH", "NEAR", "SOL") to a badge. NEAR reuses the chain badge. */
export const coinLogo = (symbol: string) => logo(symbol.toLowerCase() === 'near' ? 'near' : symbol.toLowerCase(), 'tp-logo tp-logo-sm')

/** A numbered step heading. The number comes from a CSS counter, so steps that are hidden are skipped. */
export function step(title: string, hint = ''): HTMLElement {
  const h = document.createElement('div')
  h.className = 'tp-step'
  const t = document.createElement('b')
  t.textContent = title
  h.append(t)
  if (hint) { const p = document.createElement('small'); p.textContent = hint; h.append(p) }
  return h
}

/** A coin button: badge on the left, symbol and an optional small second line. */
export function coinChip(symbol: string, sub = '', on = false): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = on ? 'tp-coin on' : 'tp-coin'
  const text = document.createElement('span')
  const name = document.createElement('b')
  name.textContent = symbol
  text.append(name)
  if (sub) { const s = document.createElement('small'); s.textContent = sub; text.append(s) }
  b.append(coinLogo(symbol), text)
  return b
}

/** A big chain card: logo, name, one short line. */
export function chainCard(id: ChainId, name: string, sub: string, badge = ''): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'tp-chain'
  b.dataset.chain = id
  const text = document.createElement('span')
  const n = document.createElement('b')
  n.textContent = name
  if (badge) { const t = document.createElement('i'); t.textContent = badge; n.append(t) }
  const s = document.createElement('small')
  s.textContent = sub
  text.append(n, s)
  const tick = document.createElement('span')
  tick.className = 'tp-tick'
  tick.setAttribute('aria-hidden', 'true')
  b.append(logo(id), text, tick)
  return b
}

/** Puts the long explanation behind a small "How this works" fold. `body` is the existing paragraph, kept as is. */
export function howItWorks(body: HTMLElement, summary = 'How this works'): HTMLDetailsElement {
  const d = document.createElement('details')
  d.className = 'tp-how'
  const s = document.createElement('summary')
  s.textContent = summary
  body.classList.add('tp-how-body')
  d.append(s, body)
  return d
}

/** A single plain line shown under the main button. */
export function hint(text: string): HTMLParagraphElement {
  const p = document.createElement('p')
  p.className = 'tp-hint'
  p.textContent = text
  return p
}

/** Marks the status line as waiting / ok / warn (refunded, expired, not credited) from what it says. Display only. */
export function watchStatus(p: HTMLElement): void {
  const mark = () => {
    const t = (p.textContent ?? '').trim()
    p.dataset.state = !t ? '' : /^credited/i.test(t) ? 'ok' : /refund/i.test(t) ? 'refund' : /expired|ended|not credited|not seen|still not|cancel|fail|reject|enter |could not|no near|install|network|not switched/i.test(t) && !/still watching/i.test(t) ? 'warn' : 'wait'
  }
  new MutationObserver(mark).observe(p, { childList: true, characterData: true, subtree: true })
  mark()
}

/** Plain wording for the end-of-order messages the server sends back (display only). */
export const plainEnd = (msg: string): string => (/refunded/i.test(msg) ? 'Refunded. Your coin was sent back to your refund address.' : msg)
