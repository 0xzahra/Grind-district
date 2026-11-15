// Certificates: id codec (v2 + old date-only ids), metadata, renderer, voucher signing, server records
// (public page renders only from a record). No chain, no money, no network: an in-memory stand-in for Supabase.
import { hashTypedData, recoverTypedDataAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { verify, createPublicKey } from 'node:crypto'
import { encodeCertId, decodeCertId, certSerial, issuedWat, issuedIso, certMetadata, certImageUrl, CERT_W, CERT_H } from '../api/_certArt.ts'
import { CERT_COURSES, CERT_RANKS } from '../api/_certCourses.ts'
import { setCertDbForTests, issueCert, findCert } from '../api/_certStore.ts'
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
const d = { n: 'Amina Bello', u: 'amina', c: 'spot', t: 'Spot trading', at }
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
ok(attr('Course') === 'Spot trading' && attr('Course ID') === 'spot' && attr('Player') === 'Amina Bello' && attr('Username') === '@amina', 'identity attributes')
ok(!m.attributes.some((a) => /rank/i.test(a.trait_type)) && !/rank/i.test(JSON.stringify(m)), 'no rank in metadata')
ok(!('r' in decodeCertId(id)!) && !('r' in JSON.parse(Buffer.from(id, 'base64url').toString())), 'new ids carry no rank')
ok(!('r' in old), 'old ids with a rank decode without it')
ok(attr('Issued (WAT)') === '11 November 2026, 09:42 WAT' && attr('Issued (ISO-8601)') === '2026-11-11T09:42:13+01:00' && attr('Chain') === 'Base' && attr('Issuer') === 'Grind District' && attr('Certificate ID') === id, 'time, chain, issuer, id')
ok(/practice credential/i.test(m.description) && /not an accredited/i.test(m.description) && !/withdraw|earn money/i.test(m.description), 'honest description')

// Renderer (server twin of the in-game canvas)
const png = await renderCertPng(back, id)
ok(png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === CERT_W && png.readUInt32BE(20) === CERT_H, `renders ${CERT_W}x${CERT_H} PNG (${Math.round(png.length / 1024)} KB)`)
const small = await renderCertPng(old, v1, 600)
ok(small.readUInt32BE(16) === 600, 'renders old ids and small sizes')
const weird = await renderCertPng({ n: '', u: '', c: '', t: '' }, 'x', 400)
ok(weird.length > 1000, 'renderer does not throw on empty data')

// Canonical cert on the server
const save = { name: 'Amina Bello', skills: { spot: { passed: true } }, activities: [{ at, label: 'Passed Spot trading' }] }
const c1 = canonicalCert(save, 'amina', 'spot', encodeCertId({ ...d, at: at + 999_000, t: 'Harvard MBA' }), at + 10_000_000)
ok(c1.ok && c1.id === id, 'server rebuilds title + pass time from the save')
ok(!canonicalCert({ ...save, skills: {} }, 'amina', 'spot', id).ok, 'refuses a course not passed')
ok(!canonicalCert(save, 'bob', 'spot', id).ok, 'refuses someone else’s certificate')
ok(!canonicalCert(save, 'amina', 'nope', id).ok, 'refuses unknown course')
const c2 = canonicalCert({ ...save, activities: [] }, 'amina', 'spot', id, at + 1000)
ok(c2.ok && c2.data.at === at && !('r' in c2.data), 'device time used when log rolled off; no rank')
const c3 = canonicalCert(save, 'amina', 'spot', '', at + 10_000_000)
ok(c3.ok && c3.id === id, 'issues with no device hint')

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
ok(bv.rank === '', 'voucher sends an empty rank (contract field kept, nothing shown)')
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
ok(nj.rank === '', 'NEAR voucher rank is empty')
ok(nj.receiver_id === 'amina.testnet' && nj.cert_id === id && nj.issued_at_ms === at && nj.deadline_ms === at + 1_800_000, 'NEAR voucher fields')

// In-memory stand-in for the Supabase tables the certificate code uses.
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { certificates: [], players: [{ privy_user_id: 'did:privy:amina', username: 'amina' }], player_progress: [{ privy_user_id: 'did:privy:amina', save }] }
function q(t: string) {
  const f: Array<[string, unknown]> = []; let lim = Infinity
  const rows = () => (tables[t] ??= []).filter((r) => f.every(([k, v]) => r[k] === v)).slice(0, lim)
  const b = {
    select: () => b, order: () => b,
    eq: (k: string, v: unknown) => { f.push([k, v]); return b },
    limit: (n: number) => { lim = n; return b },
    maybeSingle: async () => { const r = rows(); return r.length > 1 ? { data: null, error: { message: 'many' } } : { data: r[0] ?? null, error: null } },
    then: (ok: (v: unknown) => void) => ok({ data: rows(), error: null }),
    upsert: async (row: Row, o: { onConflict: string }) => {
      const T = (tables[t] ??= [])
      if (T.some((r) => r[o.onConflict] === row[o.onConflict])) return { error: null }
      if (t === 'certificates' && row.source === 'issued' && T.some((r) => r.source === 'issued' && r.username === row.username && r.course_id === row.course_id)) return { error: { message: 'dup' } }
      T.push({ ...row }); return { error: null }
    },
  }
  return b
}
const memDb = { from: q } as never
setCertDbForTests(memDb)

// Page routes (api/page.ts) render only from server records.
const page = (await import('../api/page.ts')).default
const call = async (query: Record<string, string>) => {
  const out: { code: number; headers: Record<string, string>; body: string | Buffer } = { code: 0, headers: {}, body: '' }
  await page({ query, url: `/cert/${query.id}` }, { setHeader: (k, v) => { out.headers[k] = v }, status: (n) => ({ send: (b) => { out.code = n; out.body = b } }) })
  return out
}
const invalid = (o: { code: number; body: string | Buffer; headers: Record<string, string> }) => o.code === 404 && o.headers['cache-control'] === 'no-store'
// Unissued and made-up links are not valid
const madeUp = encodeCertId({ n: 'Sample Tester', u: 'sampletester', c: 'internet', t: 'Advanced Smart Contract Auditing', at })
const madeUp2 = encodeCertId({ n: 'Sample Tester', u: 'amina', c: 'spot', t: 'Spot trading', at })
const madeUpHtml = await call({ kind: 'cert', id: madeUp })
ok(invalid(madeUpHtml) && String(madeUpHtml.body).includes('Invalid certificate') && !String(madeUpHtml.body).includes('Sample Tester'), 'made-up link (made-up course title) shows Invalid certificate')
ok(invalid(await call({ kind: 'cert', id: 'GD-ZZ00-ZZ00' })), 'unissued serial is invalid')
ok(invalid(await call({ kind: 'cert', id: madeUp2 })), 'real player + real course but a made-up name is invalid')
ok(invalid(await call({ kind: 'certpng', id: madeUp })) && invalid(await call({ kind: 'certmeta', id: madeUp })), 'made-up image + metadata are invalid')
// Issue from the synced save (no rank anywhere)
const iss = await issueCert(memDb, 'did:privy:amina', 'amina', 'spot', '')
ok(iss.ok && iss.row.cert_id === id && iss.row.serial === certSerial(back) && tables.certificates.length === 1, 'server issues one record from the synced save')
const again = await issueCert(memDb, 'did:privy:amina', 'amina', 'spot', encodeCertId({ ...d, n: 'Someone Else' }))
ok(again.ok && again.row.cert_id === id && tables.certificates.length === 1, 'asking again returns the same record')
ok(!(await issueCert(memDb, 'did:privy:amina', 'amina', 'risk', '')).ok, 'refuses a course not passed')
ok(!Object.keys(tables.certificates[0]).some((k) => /rank/i.test(k)), 'record has no rank')
// Real certificate resolves by id and by printed serial
const html = await call({ kind: 'cert', id })
ok(html.code === 200 && String(html.body).includes(`/cert/${id}/image.png`) && String(html.body).includes('og:image" content="https://www.grinddistrict.app/cert/'), 'public page shows the image and uses it for OG')
ok(String(html.body).includes('11 November 2026, 09:42 WAT') && String(html.body).includes(certSerial(back)) && String(html.body).includes('Not minted yet'), 'public page lists timestamp, serial, mint state')
ok(!/rank|dolphin|shrimp rank/i.test(String(html.body).replace(/shrimp\.png/g, '')), 'public page shows no rank')
const bySerial = await call({ kind: 'cert', id: certSerial(back) })
ok(bySerial.code === 200 && String(bySerial.body).includes('Amina Bello') && String(bySerial.body).includes(certSerial(back)), `printed serial /cert/${certSerial(back)} resolves`)
ok((await call({ kind: 'cert', id: certSerial(back).toLowerCase() })).code === 200, 'serial is case-insensitive')
const meta = await call({ kind: 'certmeta', id, chain: 'near' })
const mj = JSON.parse(String(meta.body))
ok(meta.code === 200 && mj.attributes.some((a: { trait_type: string; value: string }) => a.trait_type === 'Chain' && a.value === 'NEAR') && !/rank/i.test(String(meta.body)), 'meta.json route, no rank')
const img = await call({ kind: 'certpng', id, w: '800' })
ok(img.code === 200 && img.headers['content-type'] === 'image/png' && (img.body as Buffer).readUInt32BE(16) === 800, 'image.png route')
ok((await call({ kind: 'certpng', id: certSerial(back) })).code === 200, 'image by serial')
ok(invalid(await call({ kind: 'certpng', id: 'bad' })), 'bad id is a 404')
// Editing any field of a real link makes it invalid
const edits: Record<string, unknown> = { n: 'Amina Belo', u: 'amin', c: 'risk', t: 'Spot Trading', d: '2026-11-12', at: at + 1, v: 3 }
const raw = JSON.parse(Buffer.from(id, 'base64url').toString())
let allBad = true
for (const [k, v] of Object.entries(edits)) {
  const e = Buffer.from(JSON.stringify({ ...raw, [k]: v })).toString('base64url')
  const o = await call({ kind: 'cert', id: e })
  if (!invalid(o)) { allBad = false; console.log('   edited field still valid:', k) }
}
// The same real certificate in the older link format (it carried a rank) still opens; the rank is not shown.
const oldFmt = Buffer.from(JSON.stringify({ v: 2, n: raw.n, u: raw.u, r: 'Dolphin', c: raw.c, t: raw.t, d: raw.d, at: raw.at })).toString('base64url')
const oldBadRank = Buffer.from(JSON.stringify({ v: 2, n: raw.n, u: raw.u, r: 'Galaxy Brain', c: raw.c, t: raw.t, d: raw.d, at: raw.at })).toString('base64url')
const oldBadDate = Buffer.from(JSON.stringify({ v: 2, n: raw.n, u: raw.u, r: 'Dolphin', c: raw.c, t: raw.t, d: '2026-11-12', at: raw.at })).toString('base64url')
ok(invalid(await call({ kind: 'cert', id: oldBadRank })) && invalid(await call({ kind: 'cert', id: oldBadDate })), 'older-format link with a made-up rank or edited date is invalid')
const of = await call({ kind: 'cert', id: oldFmt })
ok(of.code === 200 && !/dolphin/i.test(String(of.body)) && String(of.body).includes(certSerial(back)), 'older-format link of a real certificate still works, no rank shown')
ok(allBad, `editing any field (${Object.keys(edits).join(', ')}) shows invalid`)
// Links shared before records existed: accepted once, only if the synced save backs every field
tables.player_progress.push({ privy_user_id: 'did:privy:bola', save: { name: 'Bola Ade', skills: { risk: { passed: true } }, activities: [{ at: at - 86_400_000, label: 'Passed Risk sizing' }] } })
tables.players.push({ privy_user_id: 'did:privy:bola', username: 'bola' })
const legacy = Buffer.from(JSON.stringify({ v: 2, n: 'Bola Ade', u: 'bola', r: 'Crab', c: 'risk', t: 'Risk sizing', d: '2026-11-10', at: at - 86_400_000 })).toString('base64url')
const legacyEdit = Buffer.from(JSON.stringify({ v: 2, n: 'Bola Ade', u: 'bola', r: 'Crab', c: 'risk', t: 'Risk sizing', d: '2026-11-10', at: at - 86_400_001 })).toString('base64url')
ok(invalid(await call({ kind: 'cert', id: legacyEdit })), 'old link with an edited time is invalid')
const lp = await call({ kind: 'cert', id: legacy })
ok(lp.code === 200 && String(lp.body).includes('Bola Ade') && !/crab|rank/i.test(String(lp.body)), 'old real link still works, rank no longer shown')
ok((await findCert(memDb, legacy))?.source === 'legacy-save', 'old real link recorded')
const ghost = Buffer.from(JSON.stringify({ v: 2, n: 'Nobody', u: 'nobody', c: 'risk', t: 'Risk sizing', at })).toString('base64url')
ok(invalid(await call({ kind: 'cert', id: ghost })), 'old-style link for an unknown player is invalid')
const old2 = Buffer.from(JSON.stringify({ v: 2, n: 'Bola Ade', u: 'bola', c: 'risk', t: 'Risk sizing', at: at - 86_400_000 + 5 })).toString('base64url')
ok(invalid(await call({ kind: 'cert', id: old2 })), 'a second, different old link for the same course is invalid')

// Voucher route: refuses honestly when no signer/contract is configured
const { certVoucher } = await import('../api/_certMint.ts')
const fakeDb = memDb
const resOf = () => { const o = { code: 0, body: {} as Record<string, unknown> }; return { o, res: { status: (n: number) => ({ json: (b: unknown) => { o.code = n; o.body = b as Record<string, unknown> } }) } } }
// Production builds have the Base mint env set too: this assertion is about the unconfigured case, so unset
// it here (this check runs in its own process; the values are set again just below for the signed cases).
delete process.env.VITE_CERT_NFT_BASE; delete process.env.CERT_SIGNER_PRIVATE_KEY
let r = resOf()
await certVoucher({ chain: 'base', course: 'spot', certId: id, to: '0x000000000000000000000000000000000000000A' }, r.res, fakeDb as never, 'did:privy:amina', 'amina', async () => [])
ok(r.o.code === 503 && r.o.body.live === false, 'no Base signer/contract: 503, not a fake success')
process.env.VITE_CERT_NFT_BASE = '0x00000000000000000000000000000000000c0ffe'
process.env.CERT_SIGNER_PRIVATE_KEY = key
r = resOf()
await certVoucher({ chain: 'base', course: 'spot', certId: id, to: '0x000000000000000000000000000000000000000B' }, r.res, fakeDb as never, 'did:privy:amina', 'amina', async () => ['0x000000000000000000000000000000000000000A'])
ok(r.o.code === 403 && /not linked/.test(String(r.o.body.error)), 'refuses a wallet not linked to the account')
r = resOf()
await certVoucher({ chain: 'base', course: 'risk', certId: encodeCertId({ ...d, c: 'risk', t: 'Risk sizing' }), to: '0x000000000000000000000000000000000000000A' }, r.res, fakeDb as never, 'did:privy:amina', 'amina', async () => ['0x000000000000000000000000000000000000000A'])
ok(r.o.code === 403 && /not passed/.test(String(r.o.body.error)), 'refuses a course not passed')
delete process.env.VITE_CERT_NFT_BASE; delete process.env.CERT_SIGNER_PRIVATE_KEY
delete process.env.VITE_CERT_NFT_NEAR; delete process.env.CERT_NEAR_SIGNER_KEY
r = resOf()
await certVoucher({ chain: 'near', course: 'spot', certId: id, receiver: 'amina.testnet' }, r.res, fakeDb as never, 'near:amina.testnet', 'amina', async () => [])
ok(r.o.code === 503, 'no NEAR signer/contract: 503')

// Certificate exam (api/_certExam.ts): graded on the server, a pass ticket for the voucher
{
  const { EXAM_BANK } = await import('../api/_certExamBank.ts')
  const { COURSES } = await import('../src/courses.ts')
  const mirror = COURSES.every((c) => JSON.stringify(EXAM_BANK[c.id]) === JSON.stringify(c.questions.map((q) => [q.prompt, q.choices, q.answer]))) && Object.keys(EXAM_BANK).length === COURSES.length
  ok(mirror, `api/_certExamBank.ts matches the lessons (${COURSES.length} courses); rerun scripts/gen-cert-exam.ts if not`)
  const { startExam, gradeExam, checkTicket, passMark } = await import('../api/_certExam.ts')
  delete process.env.CERT_NEAR_SIGNER_KEY; delete process.env.CERT_SIGNER_PRIVATE_KEY; delete process.env.CERT_EXAM_KEY
  const off = startExam('amina', 'spot')
  ok(!off.ok && off.status === 503, 'no signer key: exams are honestly off')
  process.env.CERT_EXAM_KEY = 'test-only-exam-key'
  const t0 = Date.parse('2026-11-15T12:00:00Z')
  const s1 = startExam('Amina', 'spot', t0)
  ok(s1.ok && s1.paper.questions.length === EXAM_BANK.spot!.length, 'paper has every question of the course')
  ok(s1.ok && !/"answer"|,\s*\d+\]\]/.test(JSON.stringify(s1.paper.questions)), 'paper carries no answers')
  ok(passMark(3) === 3 && passMark(4) === 3 && passMark(5) === 4 && passMark(8) === 6, 'pass mark: three in four, rounded up')
  if (s1.ok) {
    const right = s1.paper.questions.map((q) => { const b = EXAM_BANK.spot!.find((x) => x[0] === q.prompt)!; return q.choices.indexOf(b[1][b[2]]!) })
    const g = gradeExam('amina', 'spot', s1.paper.token, right, t0 + 60_000)
    ok(g.ok && g.result.passed && g.result.score === right.length && typeof g.result.ticket === 'string', 'right answers pass and earn a ticket')
    const ticket = g.ok ? g.result.ticket : ''
    ok(checkTicket('amina', 'spot', ticket, t0 + 120_000).ok, 'ticket is accepted for the same player and course')
    ok(!checkTicket('bola', 'spot', ticket, t0 + 120_000).ok, 'ticket is refused for another player')
    ok(!checkTicket('amina', 'risk', ticket, t0 + 120_000).ok, 'ticket is refused for another course')
    ok(!checkTicket('amina', 'spot', ticket, t0 + 31 * 60_000 + 60_000).ok, 'ticket expires after 30 minutes')
    ok(!checkTicket('amina', 'spot', String(ticket).replace(/^(.{4})(.)/, (_, a, c) => a + (c === 'x' ? 'y' : 'x')), t0 + 120_000).ok, 'a tampered ticket is refused')
    ok(!checkTicket('amina', 'spot', undefined, t0).ok, 'no ticket, no voucher')
    const wrong = right.map((k, i) => (i === 0 || i === 1 ? (k + 1) % s1.paper.questions[i]!.choices.length : k))
    const w = gradeExam('amina', 'spot', s1.paper.token, wrong, t0 + 60_000)
    ok(w.ok && !w.result.passed && !w.result.ticket && w.result.missed.length === 2, 'two wrong answers fail with no ticket, and say which')
    ok(!gradeExam('bola', 'spot', s1.paper.token, right, t0 + 60_000).ok, "another player cannot hand in this paper")
    ok(!gradeExam('amina', 'spot', s1.paper.token, right, t0 + (s1.paper.seconds + 5) * 1000).ok, 'a paper handed in after the time limit is refused')
    ok(!gradeExam('amina', 'spot', s1.paper.token, right.slice(1), t0 + 60_000).ok, 'every question must be answered')
  }
  delete process.env.CERT_EXAM_KEY
}

// Base Builder Code on the certificate mint (src/builderCode.ts)
{
  const { Attribution } = await import('ox/erc8021')
  const { BUILDER_CODE, BUILDER_SUFFIX, withBuilderCode } = await import('../src/builderCode.ts')
  ok(Attribution.toDataSuffix({ codes: [BUILDER_CODE] }) === `0x${BUILDER_SUFFIX}`, 'builder code suffix matches the ERC-8021 encoding')
  ok(withBuilderCode('0xabcd').endsWith(BUILDER_SUFFIX) && withBuilderCode('0xabcd').startsWith('0xabcd'), 'mint calldata keeps its arguments and ends with the builder code')
}

console.log(`cert: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
