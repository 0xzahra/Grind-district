// Inline SVG illustrations for shop items (no network, crisp on phones).
const S = (body: string) => `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="#0d1512"/>${body}</svg>`
const quad = (mid: string) => S(`<g stroke="#9fb3a8" stroke-width="4"><line x1="60" y1="40" x2="140" y2="40"/></g><g fill="#2b3a33"><ellipse cx="55" cy="34" rx="22" ry="4"/><ellipse cx="145" cy="34" rx="22" ry="4"/></g>${mid}`)
const PICS: Record<string, string> = {
  scout: quad('<rect x="85" y="38" width="30" height="16" rx="6" fill="#d9b26a"/>'),
  courier: quad('<rect x="85" y="38" width="30" height="14" rx="5" fill="#9fb3a8"/><rect x="88" y="54" width="24" height="22" fill="#a8743a"/>'),
  halo: quad('<circle cx="100" cy="50" r="18" fill="none" stroke="#17f790" stroke-width="5"/>'),
  phone: S('<rect x="80" y="10" width="40" height="80" rx="8" fill="#22272b"/><rect x="84" y="18" width="32" height="62" rx="3" fill="#3d7bd9"/>'),
  phonepro: S('<rect x="80" y="10" width="40" height="80" rx="9" fill="#8c8a86"/><rect x="84" y="15" width="32" height="70" rx="5" fill="#111"/><circle cx="93" cy="24" r="4" fill="#333"/><circle cx="103" cy="24" r="4" fill="#333"/>'),
  laptop: S('<rect x="55" y="18" width="90" height="56" rx="4" fill="#c9ccd1"/><rect x="60" y="23" width="80" height="46" fill="#1d2a3a"/><path d="M40 76h120l-8 8H48z" fill="#a9adb3"/>'),
  desktop: S('<rect x="40" y="15" width="90" height="58" rx="3" fill="#222"/><rect x="45" y="20" width="80" height="48" fill="#2f6d5a"/><rect x="78" y="73" width="14" height="12" fill="#444"/><rect x="62" y="85" width="46" height="5" fill="#444"/><rect x="142" y="20" width="26" height="70" rx="3" fill="#2a2a2a"/><circle cx="155" cy="30" r="3" fill="#17f790"/>'),
  earbuds: S('<rect x="70" y="40" width="60" height="40" rx="18" fill="#eee"/><circle cx="88" cy="35" r="10" fill="#fafafa"/><circle cx="112" cy="35" r="10" fill="#fafafa"/>'),
  watch: S('<rect x="88" y="5" width="24" height="90" rx="6" fill="#d96a6a"/><rect x="78" y="28" width="44" height="44" rx="10" fill="#222"/><rect x="83" y="33" width="34" height="34" rx="6" fill="#17f790" opacity=".8"/>'),
  saloon: S('<path d="M30 70h140v-14l-22-4-18-16H72L52 52 30 56z" fill="#55595e"/><rect x="76" y="40" width="44" height="12" fill="#9cc"/><circle cx="62" cy="72" r="10" fill="#111"/><circle cx="142" cy="72" r="10" fill="#111"/>'),
  tourer: S('<path d="M20 70h160v-10l-30-6-20-14H96L80 54 20 58z" fill="#7a2626"/><rect x="100" y="44" width="34" height="10" fill="#9cc"/><circle cx="50" cy="72" r="10" fill="#111"/><circle cx="150" cy="72" r="10" fill="#111"/>'),
  lightjet: S('<path d="M20 52l150-6c10 0 14 4 14 6s-4 6-14 6L20 56z" fill="#e8e8e8"/><path d="M90 52l-20-26h12l30 26zM90 54l-20 26h12l30-26zM24 52l-8-18h8l12 18z" fill="#c7c7c7"/>'),
  longjet: S('<path d="M10 50l170-6c10 0 14 4 14 6s-4 6-14 6L10 54z" fill="#f2f2f2"/><path d="M80 50l-28-34h14l40 34zM80 54l-28 34h14l40-34zM14 50l-8-20h8l14 20z" fill="#3d5a80"/>'),
  skydrone: S('<ellipse cx="100" cy="60" rx="34" ry="16" fill="#e6e6e6"/><rect x="86" y="48" width="28" height="10" rx="4" fill="#9cc"/><g fill="#2b3a33"><ellipse cx="45" cy="30" rx="22" ry="4"/><ellipse cx="155" cy="30" rx="22" ry="4"/></g><g stroke="#9fb3a8" stroke-width="4"><line x1="45" y1="30" x2="80" y2="55"/><line x1="155" y1="30" x2="120" y2="55"/></g>'),
}
export function itemPic(id: string): HTMLElement {
  const d = document.createElement('div'); d.className = 'shop-pic'; d.setAttribute('role', 'img'); d.setAttribute('aria-label', id)
  d.innerHTML = PICS[id] ?? S('')
  return d
}
