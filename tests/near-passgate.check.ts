// NEAR passport gate: with no passed course the page shows no wallet panel and no save button;
// with flags unset the feature is off. Uses a tiny DOM stub; no network, no wallet.
type N = { tag: string; children: N[]; textContent: string; className: string; style: Record<string, string>; append: (...c: N[]) => void; replaceChildren: (...c: N[]) => void; setAttribute: () => void }
const mk = (tag: string): N => { const n: N = { tag, children: [], textContent: '', className: '', style: {}, append: (...c) => { n.children.push(...c) }, replaceChildren: (...c) => { n.children = c }, setAttribute: () => {} }; return n }
;(globalThis as any).document = { createElement: mk }
const walk = (n: N, out: N[] = []): N[] => { out.push(n); for (const c of n.children ?? []) walk(c, out); return out }
const m = await import('../src/nearPassport.ts')
if (m.nearPassportOn()) throw new Error('passport must be off without VITE_NEAR_PASSPORT=1 and a .testnet contract')
const page = m.nearPassportPage([], () => 'x') as unknown as N
const all = walk(page)
if (all.some((n) => n.className === 'near-pass')) throw new Error('no-pass page must not render a wallet panel')
if (all.some((n) => n.tag === 'button')) throw new Error('no-pass page must not offer any button')
if (!all.some((n) => /appears here after you pass/.test(n.textContent))) throw new Error('missing pass-first copy')
if (all.some((n) => /learning hall/i.test(n.textContent))) throw new Error('old "learning hall" wording')
console.log('ok - NEAR passport: off by default; no save path before a pass')
process.exit(0)
