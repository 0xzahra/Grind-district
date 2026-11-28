// Solana wallet sign-in helpers: the SIWS text Privy expects, and base64 for the signature.
import { siwsMessage, toBase64 } from '../src/solanaLogin.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) { pass++; console.log('  ok', name) } else { fail++; console.error('  FAIL', name) } }

const addr = '4FfCyMKUXv3cuuwETY6vePCv2fMPriEZPFR8ewqr1Fe9'
const m = siwsMessage({ address: addr, nonce: 'n0nce', domain: 'www.grinddistrict.app', uri: 'https://www.grinddistrict.app', issuedAt: '2026-11-28T08:00:00.000Z' })
const lines = m.split('\n')
ok('first line names the domain and a Solana account', lines[0] === 'www.grinddistrict.app wants you to sign in with your Solana account:')
ok('second line is the address', lines[1] === addr)
ok('carries uri, version, chain, nonce, time', m.includes('URI: https://www.grinddistrict.app\nVersion: 1\nChain ID: mainnet\nNonce: n0nce\nIssued At: 2026-11-28T08:00:00.000Z'))
ok('ends with the Privy resource line', m.endsWith('Resources:\n- https://privy.io'))
ok('no funds or transaction wording', !/transfer|transaction|send/i.test(m))
ok('base64 of 64 zero bytes', toBase64(new Uint8Array(64)) === 'A'.repeat(86) + '==')
ok('base64 round trip', toBase64(Uint8Array.from([1, 2, 3, 250, 255])) === Buffer.from([1, 2, 3, 250, 255]).toString('base64'))
console.log(`solana-login: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
