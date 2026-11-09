import { generateKeyPairSync, sign as cryptoSign, createPrivateKey, createPublicKey, randomBytes } from 'crypto'
import { writeFileSync, readFileSync, existsSync } from 'fs'
const PATH = '/tmp/gd-near-test-keypair.json'
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
  const b = Buffer.from(s, 'utf8'); const len = Buffer.alloc(4); len.writeUInt32LE(b.length)
  return Buffer.concat([len, b])
}
function nep413Bytes(message, nonce, recipient) {
  const tag = Buffer.alloc(4); tag.writeUInt32LE(TAG >>> 0)
  return Buffer.concat([tag, borshString(message), nonce, borshString(recipient), Buffer.from([0])])
}
export function loadOrCreate() {
  if (existsSync(PATH)) return JSON.parse(readFileSync(PATH, 'utf8'))
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const spki = publicKey.export({ type: 'spki', format: 'der' })
  const rawPub = spki.subarray(spki.length - 32)
  const accountId = 'gdtestbot' + Date.now().toString(36).slice(-6) + '.testnet'
  const kp = {
    accountId,
    publicKey: 'ed25519:' + b58encode(rawPub),
    pkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  }
  writeFileSync(PATH, JSON.stringify(kp))
  return kp
}
export function signLogin(kp, message, nonceB64) {
  const nonce = Buffer.from(nonceB64, 'base64')
  const bytes = nep413Bytes(message, nonce, RECIPIENT)
  const key = createPrivateKey({ key: Buffer.from(kp.pkcs8, 'base64'), format: 'der', type: 'pkcs8' })
  const signature = cryptoSign(null, bytes, key)
  return {
    accountId: kp.accountId,
    publicKey: kp.publicKey,
    signature: signature.toString('base64'),
    message,
    recipient: RECIPIENT,
    nonce: nonceB64,
  }
}
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('near-keypair.mjs')) {
  const kp = loadOrCreate()
  console.log(JSON.stringify({ accountId: kp.accountId, publicKey: kp.publicKey }))
}
