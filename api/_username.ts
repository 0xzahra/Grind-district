export const USERNAME = /^[a-z0-9_]{3,20}$/
const BLOCK = ['admin','administrator','root','support','help','moderator','mod','staff','official','grind','grinddistrict','zahra','0xzahra','arewah','0xarewah','privy','system','null','undefined','treasury','wallet','base','coinbase','metamask',
  'fuck','shit','bitch','cunt','nigger','nigga','fag','faggot','rape','nazi','hitler','porn','sex','slut','whore','dick','pussy','cock','kys']
export function cleanUsername(raw: unknown): { ok: true; name: string } | { ok: false; reason: string } {
  const name = String(raw ?? '').trim().toLowerCase()
  if (!USERNAME.test(name)) return { ok: false, reason: '3–20 characters: a–z, 0–9 or _' }
  const flat = name.replace(/_/g, '')
  if (BLOCK.some((w) => flat === w || (w.length > 3 && flat.includes(w)))) return { ok: false, reason: 'That username is not available' }
  return { ok: true, name }
}
