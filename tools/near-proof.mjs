import { generateKeyPairSync, sign as cryptoSign, createPrivateKey, createPublicKey } from 'crypto'
import { writeFileSync } from 'fs'

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
function borshString(s) {
  const b = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(4); len.writeUInt32LE(b.length)
  return Buffer.concat([len, b])
}
function nep413Bytes(message, nonce, recipient) {
  const tag = Buffer.alloc(4); tag.writeUInt32LE(TAG >>> 0)
  return Buffer.concat([tag, borshString(message), nonce, borshString(recipient), Buffer.from([0])])
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const spki = publicKey.export({ type: 'spki', format: 'der' })
const rawPub = spki.subarray(spki.length - 32)
const nonce = crypto.getRandomValues ? Buffer.from(crypto.getRandomValues(new Uint8Array(32))) : require('crypto').randomBytes(32)
const nonceB64 = nonce.toString('base64')
const accountId = 'gdtestbot' + Date.now().toString(36).slice(-6) + '.testnet'
const message = `Grind District login\n${Date.now()}\n${nonceB64}`
const bytes = nep413Bytes(message, nonce, RECIPIENT)
const signature = cryptoSign(null, bytes, privateKey)
const proof = {
  accountId,
  publicKey: 'ed25519:' + b58encode(rawPub),
  signature: signature.toString('base64'),
  message,
  recipient: RECIPIENT,
  nonce: nonceB64,
}
writeFileSync('/tmp/near-proof.json', JSON.stringify(proof, null, 2))
console.log(JSON.stringify(proof))
