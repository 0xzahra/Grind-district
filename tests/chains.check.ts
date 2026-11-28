// Multichain router (src/chains/router.ts), NEAR mainnet alongside testnet, and the optional Base EAS attestation.
import { recoverTypedDataAddress, hashDomain, keccak256, toHex, decodeFunctionData, type Hex } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { ROUTES, routeContract, routesFor, walletFor, BUILDER_CODE, type RouteId } from '../src/chains/router.ts'
import { BUILDER_CODE as BC, BUILDER_SUFFIX } from '../src/builderCode.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// ---- router config
check(BUILDER_CODE === BC, 'router Builder Code is the game one')
check(ROUTES.base.deployed === '0xBEC44b497b5D4696644A5ad581804476CB20808f' && ROUTES.base.chainId === 8453, 'Base route points at the live certificate contract')
check(ROUTES['near-testnet'].status === 'live' && ROUTES['near-mainnet'].deployed === 'cert.grinddistrict.near', 'NEAR testnet stays live, mainnet listed alongside')
check(walletFor('base') === 'privy-evm' && walletFor('base-eas') === 'privy-evm' && walletFor('solana-devnet') === 'solana' && walletFor('near-mainnet') === 'near', 'wallet model: EVM shared, Solana separate, NEAR own flow')
check(Object.values(ROUTES).every((r) => r.gas.payer === 'player'), 'players pay their own gas on every route today')
check(routesFor('spot').includes('near-testnet') && routesFor('spot').includes('base'), 'every course routes to NEAR testnet and Base')
const env = { VITE_CERT_NFT_BASE: '0xBEC44b497b5D4696644A5ad581804476CB20808f', VITE_CERT_NFT_NEAR: 'grinddistrict-cert.testnet', VITE_CERT_NFT_NEAR_MAINNET: 'cert.grinddistrict.near' }
check(routeContract('base', env) === env.VITE_CERT_NFT_BASE, 'Base contract read from env')
check(routeContract('near-testnet', env) === 'grinddistrict-cert.testnet' && routeContract('near-mainnet', env) === 'cert.grinddistrict.near', 'both NEAR contracts read from env')
check(routeContract('near-mainnet', { VITE_CERT_NFT_NEAR_MAINNET: 'x.testnet' }) === null, 'a .testnet name is refused as the mainnet contract')
check(routeContract('near-mainnet', {}) === null && routeContract('solana-devnet', {}) === null, 'routes are off while their env is empty')
check(routeContract('base-eas', { CERT_EAS_SCHEMA_UID: '0x' + '1'.repeat(64) }) === null, 'EAS route needs CERT_EAS=1 too')
for (const id of Object.keys(ROUTES) as RouteId[]) check(ROUTES[id].id === id, `route ${id} keyed by its id`)

// ---- server: NEAR contract per network
const chain = await import('../api/_certChain.ts')
process.env.VITE_CERT_NFT_NEAR = 'grinddistrict-cert.testnet'; delete process.env.VITE_CERT_NFT_NEAR_MAINNET
check(chain.nearContractFor('testnet') === 'grinddistrict-cert.testnet' && chain.nearContractFor('mainnet') === null, 'mainnet off until VITE_CERT_NFT_NEAR_MAINNET is set; testnet unchanged')
process.env.VITE_CERT_NFT_NEAR_MAINNET = 'cert.grinddistrict.near'
check(chain.nearContractFor('mainnet') === 'cert.grinddistrict.near' && chain.nearContractFor('testnet') === 'grinddistrict-cert.testnet', 'with the env set, both networks resolve')
check(chain.nearNetwork() === 'testnet' && chain.nearContract() === 'grinddistrict-cert.testnet', 'the main NEAR contract (testnet) is not replaced')
delete process.env.VITE_CERT_NFT_NEAR_MAINNET

// ---- NEAR mainnet voucher route refuses honestly while off
{
  const { certVoucher } = await import('../api/_certMint.ts')
  const row = { cert_id: 'X', serial: 'GD-X', username: 'amina', privy_user_id: 'did:privy:amina', course_id: 'spot', course_title: 'Spot', player_name: 'Amina', issued_ms: 1, issued_date: '2026-11-01', tries: 1, source: 'issued' }
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) }
  const db = { from: () => q }
  const o = { code: 0, body: {} as Record<string, unknown> }
  const res = { status: (n: number) => ({ json: (b: unknown) => { o.code = n; o.body = b as Record<string, unknown> } }) }
  process.env.CERT_NEAR_SIGNER_KEY = 'ed25519:' + '1'.repeat(43)
  await certVoucher({ chain: 'near', network: 'mainnet', course: 'spot', receiver: 'amina.near' }, res, db as never, 'did:privy:amina', 'amina', async () => [])
  check(o.code === 503 && /mainnet/.test(String(o.body.error)), 'mainnet requested while not configured: 503')
  process.env.VITE_CERT_NFT_NEAR_MAINNET = 'cert.grinddistrict.near'
  await certVoucher({ chain: 'near', network: 'mainnet', course: 'spot', receiver: 'amina.testnet' }, res, db as never, 'did:privy:amina', 'amina', async () => [])
  check(o.code === 400 && /mainnet/.test(String(o.body.error)), 'a .testnet receiver is refused for mainnet')
  await certVoucher({ chain: 'near', network: 'mainnet', course: 'spot', receiver: 'amina.near' }, res, db as never, 'near:amina.testnet', 'amina', async () => [])
  check(o.code === 403, 'NEAR sign-in users mint only to the account they signed in with')
  delete process.env.VITE_CERT_NFT_NEAR_MAINNET; delete process.env.CERT_NEAR_SIGNER_KEY
}

// ---- EAS (Base) delegated attestation
const eas = await import('../api/_certEas.ts')
// Values read from Base mainnet (EAS predeploy) on 28 Nov 2026: getDomainSeparator() and getAttestTypeHash().
const BASE_DOMAIN_SEPARATOR = '0x6c7caf493ff74dde1783161593c0911e74bb65fce09f90837a991e7282d9e71c'
const BASE_ATTEST_TYPEHASH = '0xfeb2925a02bae3dae48d424a0437a2b6ac939aa9230ddc55a1a76f065d988076'
check(hashDomain({ domain: eas.EAS_DOMAIN, types: { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }] } }) === BASE_DOMAIN_SEPARATOR, 'EAS domain matches Base mainnet')
check(keccak256(toHex('Attest(' + eas.ATTEST_TYPES.Attest.map((f) => `${f.type} ${f.name}`).join(',') + ')')) === BASE_ATTEST_TYPEHASH, 'Attest type matches Base mainnet')
check(/^0x[0-9a-f]{64}$/.test(eas.schemaUid()) && eas.schemaUid() === eas.schemaUid(eas.CERT_EAS_SCHEMA), 'schema uid is stable')
check(!/ (playerName|name|email|wallet)(,|$)/i.test(eas.CERT_EAS_SCHEMA), 'schema carries no player name, email or wallet field')
delete process.env.CERT_EAS
check(!eas.easLive(), 'EAS off by default')
process.env.CERT_EAS = '1'; process.env.CERT_EAS_SCHEMA_UID = '0x' + '2'.repeat(64)
check(!eas.easLive(), 'EAS stays off when the uid is not this schema')
process.env.CERT_EAS_SCHEMA_UID = eas.schemaUid()
check(eas.easLive(), 'EAS on with the flag and the right uid')
delete process.env.CERT_EAS; delete process.env.CERT_EAS_SCHEMA_UID
{
  const key = generatePrivateKey(), signer = privateKeyToAccount(key), player = privateKeyToAccount(generatePrivateKey()).address
  const d = { v: 2 as const, n: 'Amina', u: 'amina', c: 'spot', t: 'Spot trading', at: Date.parse('2026-11-11T08:42:00Z') }
  const out = await eas.easAttestationRequest(key, player, 'CERTID', d as never, { nonce: 7n, now: Date.parse('2026-11-28T08:00:00Z') })
  check(out.attester === signer.address && out.to === eas.EAS_BASE && out.nonce === '7', 'request names the signer as attester')
  check(out.calldata.endsWith(BUILDER_SUFFIX), 'Builder Code appended to the attestation calldata')
  const call = decodeFunctionData({ abi: eas.ATTEST_BY_DELEGATION_ABI, data: out.calldata.slice(0, out.calldata.length - BUILDER_SUFFIX.length) as Hex })
  const req = call.args[0]
  const sig = (req.signature.r + req.signature.s.slice(2) + req.signature.v.toString(16)) as Hex
  const rec = await recoverTypedDataAddress({ domain: eas.EAS_DOMAIN, types: eas.ATTEST_TYPES, primaryType: 'Attest', message: { attester: req.attester, schema: req.schema, recipient: req.data.recipient, expirationTime: req.data.expirationTime, revocable: req.data.revocable, refUID: req.data.refUID, data: req.data.data, value: req.data.value, nonce: 7n, deadline: req.deadline }, signature: sig })
  check(rec === signer.address && req.data.recipient === player, 'delegated signature recovers to the attester, recipient is the player')
}

console.log(`chains: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
