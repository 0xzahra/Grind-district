// Certificates: id codec (v2 + old date-only ids), metadata, renderer, voucher signing. No chain, no money.
import { hashTypedData, recoverTypedDataAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { verify, createPublicKey } from 'node:crypto'
import { encodeCertId, decodeCertId, certSerial, issuedWat, issuedIso, certMetadata, certImageUrl, CERT_W, CERT_H } from '../api/_certArt.ts'
import { CERT_COURSES, CERT_RANKS } from '../api/_certCourses.ts'
import { canonicalCert, baseVoucher, signBaseVoucher, VOUCHER_TYPES, certDomain, nearVoucherJson, signNearVoucher, nearSignerPublicKey, b58decode, b58encode } from '../api/_certVoucher.ts'
import { renderCertPng } from '../api/_certRender.ts'
import { SKILL_ORDER, SKILL_META, RANKS } from '../src/logic.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

// Course list mirror
ok(SKILL_ORDER.every((id) => CERT_COURSES[id] === SKILL_META[id].title) && Object.keys(CERT_COURSES).length === SKILL_ORDER.length, `api/_certCourses.ts matches SKILL_META (${SKILL_ORDER.length}); rerun scripts/gen-cert-courses.ts if not`)
ok(JSON.stringify(CERT_RANKS) === JSON.stringify(RANKS.map((r) => r.label)), 'ranks mirror')

// Codec
const at = Date.parse('2026-11-11T08:42:13Z')
const d = { n: 'Amina Bello', u: 'amina', r: 'Dolphin', c: 'spot', t: 'Spot trading', at }
const id = encodeCertId(d)
const back = decodeCertId(id)!
ok(back.v === 2 && back.n === 'Amina Bello' && back.at === at && back.d === '2026-11-11', 'v2 round trip keeps timestamp')
ok(encodeCertId(d) === id, 'id is stable')
ok(issuedWat(back) === '11 November 2026, 09:42 WAT', `WAT ${issuedWat(back)}`)
ok(issuedIso(back) === '2026-11-11T09:42:13+01:00', `ISO ${issuedIso(back)}`)
const late = decodeCertId(encodeCertId({ ...d, at: Date.parse('2026-11-11T23:30:00Z') }))!
ok(late.d === '2026-11-12' && issuedWat(late).startsWith('12 November 2026, 00:30'), 'WAT date rolls over at UTC 23:00')
// Old v1 id exactly as the previous game produced it (btoa of JSON, date only)
const v1 = Buffer.from(JSON.stringify({ n: 'Amina Bello', u: 'amina', r: 'Crab', c: 'risk', t: 'Risk sizing', d: '2026-10-02' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const old = decodeCertId(v1)!
ok(old && old.v === 1 && old.d === '2026-10-02' && old.at === undefined && old.t === 'Risk sizing', 'old date-only id decodes')
ok(issuedWat(old) === '2 October 2026' && issuedIso(old) === '2026-10-02', 'old id shows the date only')
const uni = decodeCertId(encodeCertId({ ...d, n: 'Ọlá "Ade" \\ Ñ' }))!
ok(uni.n === "Ọlá 'Ade' / Ñ", `unicode kept, quote/backslash swapped: ${uni.n}`)
ok(decodeCertId('not*valid') === null && decodeCertId('') === null && decodeCertId('e30') === null, 'garbage rejected')
ok(/^GD-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(certSerial(back)) && certSerial(back) === certSerial(decodeCertId(id)!), `serial ${certSerial(back)}`)
ok(certSerial(back) !== certSerial({ ...back, c: 'risk' }), 'serial differs per course')

// Metadata
const m = certMetadata(id, back, 'base')
const attr = (k: string) => m.attributes.find((a) => a.trait_type === k)?.value
ok(m.image === certImageUrl(id) && m.image.startsWith('https://www.grinddistrict.app/cert/'), 'image url on www')
ok(m.external_url === `https://www.grinddistrict.app/cert/${id}`, 'external_url')
ok(attr('Course') === 'Spot trading' && attr('Course ID') === 'spot' && attr('Player') === 'Amina Bello' && attr('Username') === '@amina' && attr('Rank at issue') === 'Dolphin', 'identity attributes')
ok(attr('Issued (WAT)') === '11 November 2026, 09:42 WAT' && attr('Issued (ISO-8601)') === '2026-11-11T09:42:13+01:00' && attr('Chain') === 'Base' && attr('Issuer') === 'Grind District' && attr('Certificate ID') === id, 'time, chain, issuer, id')
ok(/practice credential/i.test(m.description) && /not an accredited/i.test(m.description) && !/withdraw|earn money/i.test(m.description), 'honest description')

// Renderer (server twin of the in-game canvas)
const png = await renderCertPng(back, id)
ok(png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === CERT_W && png.readUInt32BE(20) === CERT_H, `renders ${CERT_W}x${CERT_H} PNG (${Math.round(png.length / 1024)} KB)`)
const small = await renderCertPng(old, v1, 600)
ok(small.readUInt32BE(16) === 600, 'renders old ids and small sizes')
const weird = await renderCertPng({ n: '', u: '', r: '', c: '', t: '' }, 'x', 400)
ok(weird.length > 1000, 'renderer does not throw on empty data')

// Canonical cert on the server
const save = { name: 'Amina Bello', skills: { spot: { passed: true } }, activities: [{ at, label: 'Passed Spot trading' }] }
const c1 = canonicalCert(save, 'amina', 'spot', encodeCertId({ ...d, at: at + 999_000, t: 'Harvard MBA' }), at + 10_000_000)
ok(c1.ok && c1.id === id, 'server rebuilds title + pass time from the save')
ok(!canonicalCert({ ...save, skills: {} }, 'amina', 'spot', id).ok, 'refuses a course not passed')
ok(!canonicalCert(save, 'bob', 'spot', id).ok, 'refuses someone else’s certificate')
ok(!canonicalCert(save, 'amina', 'nope', id).ok, 'refuses unknown course')
const c2 = canonicalCert({ ...save, activities: [] }, 'amina', 'spot', encodeCertId({ ...d, r: 'Galaxy Brain' }), at + 1000)
ok(c2.ok && c2.data.r === 'Shrimp' && c2.data.at === at, 'unknown rank falls back; device time used when log rolled off')

// Base EIP-712: matches the Solidity hash (contracts/test/GrindCertificate.t.sol test_hashMatchesServer)
const fixed = { to: '0x000000000000000000000000000000000000000A', courseId: 'spot', courseTitle: 'Spot trading', playerName: 'Amina Bello', username: 'amina', rank: 'Dolphin', issuedAt: 1794386533n, issuedWat: '11 November 2026, 09:42 WAT', serial: 'GD-RN02-9BHY', certId: 'eyJ2IjoyLCJuIjoiQW1pbmEifQ', deadline: 1794390133n } as const
const domain = certDomain(31337, '0x00000000000000000000000000000000000c0ffe')
const digest = hashTypedData({ domain, types: VOUCHER_TYPES, primaryType: 'Voucher', message: fixed })
ok(digest === '0xcd16a44ecdc830e8789f80cf649350f88f6254025635caedefa35b6ec4d9daab', `EIP-712 digest equals the Solidity hashVoucher (${digest})`)
const key = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const // public anvil test key #1, never funded
const bv = baseVoucher('0x000000000000000000000000000000000000000A', id, back, at)
const sig = await signBaseVoucher(key, 8453, '0x00000000000000000000000000000000000c0ffe', bv)
const who = await recoverTypedDataAddress({ domain: certDomain(8453, '0x00000000000000000000000000000000000c0ffe'), types: VOUCHER_TYPES, primaryType: 'Voucher', message: bv, signature: sig })
ok(who === privateKeyToAccount(key).address, 'voucher recovers to signer')
ok(bv.issuedAt === BigInt(Math.floor(at / 1000)) && bv.deadline > bv.issuedAt && bv.serial === certSerial(back) && bv.issuedWat === issuedWat(back), 'voucher carries the same fields as the art')

// NEAR ed25519 voucher
ok(b58encode(b58decode('3yMApqCuCjXDWPrbjfR5mjCPTHqFG8Pux1TxQrEM35jj')) === '3yMApqCuCjXDWPrbjfR5mjCPTHqFG8Pux1TxQrEM35jj', 'base58 round trip')
const seed = 'ed25519:' + b58encode(Buffer.alloc(32, 7))
const json = nearVoucherJson('cert.grind.testnet', 'amina.testnet', id, back, at)
const nsig = signNearVoucher(seed, json)
const pub = b58decode(nearSignerPublicKey(seed).slice(8))
const spki = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]), format: 'der', type: 'spki' })
ok(verify(null, Buffer.from(json), spki, Buffer.from(nsig, 'base64')), 'NEAR voucher signature verifies')
const nj = JSON.parse(json)
ok(nj.receiver_id === 'amina.testnet' && nj.cert_id === id && nj.issued_at_ms === at && nj.deadline_ms === at + 1_800_000, 'NEAR voucher fields')

// Public page + image + metadata routes (api/page.ts), no network: no contract env set.
const page = (await import('../api/page.ts')).default
const call = async (query: Record<string, string>) => {
  const out: { code: number; headers: Record<string, string>; body: string | Buffer } = { code: 0, headers: {}, body: '' }
  await page({ query, url: `/cert/${query.id}` }, { setHeader: (k, v) => { out.headers[k] = v }, status: (n) => ({ send: (b) => { out.code = n; out.body = b } }) })
  return out
}
const html = await call({ kind: 'cert', id })
ok(html.code === 200 && String(html.body).includes(`/cert/${id}/image.png`) && String(html.body).includes('og:image" content="https://www.grinddistrict.app/cert/'), 'public page shows the image and uses it for OG')
ok(String(html.body).includes('11 November 2026, 09:42 WAT') && String(html.body).includes(certSerial(back)) && String(html.body).includes('Not minted yet'), 'public page lists timestamp, serial, mint state')
const meta = await call({ kind: 'certmeta', id, chain: 'near' })
const mj = JSON.parse(String(meta.body))
ok(meta.code === 200 && mj.attributes.some((a: { trait_type: string; value: string }) => a.trait_type === 'Chain' && a.value === 'NEAR'), 'meta.json route')
const img = await call({ kind: 'certpng', id, w: '800' })
ok(img.code === 200 && img.headers['content-type'] === 'image/png' && (img.body as Buffer).readUInt32BE(16) === 800, 'image.png route')
ok((await call({ kind: 'certpng', id: 'bad' })).code === 404, 'bad id is a 404')

// Voucher route: refuses honestly when no signer/contract is configured
const { certVoucher } = await import('../api/_certMint.ts')
const fakeDb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { save } }) }) }) }) }
const resOf = () => { const o = { code: 0, body: {} as Record<string, unknown> }; return { o, res: { status: (n: number) => ({ json: (b: unknown) => { o.code = n; o.body = b as Record<string, unknown> } }) } } }
let r = resOf()
await certVoucher({ chain: 'base', course: 'spot', certId: id, to: '0x000000000000000000000000000000000000000A' }, r.res, fakeDb as never, 'did:privy:x', 'amina', async () => [])
ok(r.o.code === 503 && r.o.body.live === false, 'no Base signer/contract: 503, not a fake success')
process.env.VITE_CERT_NFT_BASE = '0x00000000000000000000000000000000000c0ffe'
process.env.CERT_SIGNER_PRIVATE_KEY = key
r = resOf()
await certVoucher({ chain: 'base', course: 'spot', certId: id, to: '0x000000000000000000000000000000000000000B' }, r.res, fakeDb as never, 'did:privy:x', 'amina', async () => ['0x000000000000000000000000000000000000000A'])
ok(r.o.code === 403 && /not linked/.test(String(r.o.body.error)), 'refuses a wallet not linked to the account')
r = resOf()
await certVoucher({ chain: 'base', course: 'risk', certId: encodeCertId({ ...d, c: 'risk', t: 'Risk sizing' }), to: '0x000000000000000000000000000000000000000A' }, r.res, fakeDb as never, 'did:privy:x', 'amina', async () => ['0x000000000000000000000000000000000000000A'])
ok(r.o.code === 403 && /not passed/.test(String(r.o.body.error)), 'refuses a course not passed')
delete process.env.VITE_CERT_NFT_BASE; delete process.env.CERT_SIGNER_PRIVATE_KEY
delete process.env.VITE_CERT_NFT_NEAR; delete process.env.CERT_NEAR_SIGNER_KEY
r = resOf()
await certVoucher({ chain: 'near', course: 'spot', certId: id, receiver: 'amina.testnet' }, r.res, fakeDb as never, 'near:amina.testnet', 'amina', async () => [])
ok(r.o.code === 503, 'no NEAR signer/contract: 503')

console.log(`cert: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
