// Writes sample certificate PNGs (fictional player) for review: node --experimental-strip-types scripts/cert-previews.ts [outDir]
import { writeFileSync, mkdirSync } from 'node:fs'
import { renderCertPng } from '../api/_certRender.ts'
import { encodeCertId, type CertData } from '../api/_certArt.ts'

const out = process.argv[2] || 'shots/certs'
mkdirSync(out, { recursive: true })
const at = Date.parse('2026-11-11T08:42:13Z')
const base = { n: 'Amina Bello', u: 'amina', r: 'Dolphin' }
const samples: CertData[] = [
  { ...base, c: 'spot', t: 'Spot trading', at },
  { ...base, c: 'explorer', t: 'Reading a block explorer (Basescan)', at: at + 86_400_000 * 2 + 3_600_000 },
  { ...base, c: 'wallets', t: 'Wallet safety & seed phrases', at: at - 86_400_000 * 5 },
  { ...base, c: 'w1Boss', t: 'Boss: Web eras', at: at - 86_400_000 * 9 },
  { n: 'Amina Bello', u: 'amina', r: 'Crab', c: 'risk', t: 'Risk sizing', d: '2026-10-02' }, // old date-only id
]
for (const d of samples) {
  const id = encodeCertId(d)
  writeFileSync(`${out}/cert-${d.c}${d.at ? '' : '-legacy-id'}.png`, await renderCertPng(d, id))
}
const id = encodeCertId(samples[0])
writeFileSync(`${out}/cert-spot-phone-720.png`, await renderCertPng(samples[0], id, 720))
console.log('wrote', samples.length + 1, 'certificates to', out)
