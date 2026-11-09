import { createPublicKey, verify as cryptoVerify, generateKeyPairSync, sign as cryptoSign, randomBytes } from 'crypto'
const TAG = 2147484061
const RECIPIENT = 'grinddistrict.vercel.app'
const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function b58encode(buf) {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex'))
  let out = ''
  while (n > 0n) { out = ALPH[Number(n % 58n)] + out; n /= 58n }
  for (const b of buf) { if (b === 0) out = '1' + out; else break }
  return out || '1'
}
function b58decode(s) {
  let n = 0n
  for (const c of s) { const i = ALPH.indexOf(c); if (i < 0) throw new Error('bad'); n = n * 58n + BigInt(i) }
  const hex = n.toString(16)
  const buf = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex')
  let pad = 0; for (const c of s) { if (c === '1') pad++; else break }
  return Buffer.concat([Buffer.alloc(pad), buf])
}
function borshString(s) {
  const b = Buffer.from(s, 'utf8'); const len = Buffer.alloc(4); len.writeUInt32LE(b.length)
  return Buffer.concat([len, b])
}
function nep413Bytes(message, nonce, recipient) {
  const tag = Buffer.alloc(4); tag.writeUInt32LE(TAG >>> 0)
  return Buffer.concat([tag, borshString(message), nonce, borshString(recipient), Buffer.from([0])])
}
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const spki = publicKey.export({ type: 'spki', format: 'der' })
const rawPub = spki.subarray(spki.length - 32)
const nonce = randomBytes(32)
const nonceB64 = nonce.toString('base64')
const message = `Grind District login\n${Date.now()}\n${nonceB64}`
const bytes = nep413Bytes(message, nonce, RECIPIENT)
const sig = cryptoSign(null, bytes, privateKey)
const pubB58 = b58encode(rawPub)
const pub2 = b58decode(pubB58)
const spki2 = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub2])
const key = createPublicKey({ key: spki2, format: 'der', type: 'spki' })
const ok = cryptoVerify(null, bytes, key, sig)
console.log(JSON.stringify({ ok, accountId: 'localverify.testnet', pubLen: rawPub.length, sigLen: sig.length }))
if (!ok) process.exit(1)
