#!/usr/bin/env node
// Admin + self-test for the grind-cert Solana program (programs/grind-cert).
//   GD_SOL_ACTION=init|status|selftest  CERT_SOLANA_KEY_FILE=/path/issuer.json  CERT_SOLANA_RPC=…  node scripts/solana-cert.mjs
// The issuer key is read from a file (never argv, never printed). Prints only public addresses and signatures.
// Refuses mainnet unless GD_SOL_ALLOW_MAINNET=1.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'

const PROGRAM = new PublicKey(process.env.VITE_CERT_SOLANA_PROGRAM || '6NJLLRRTkvEwijjSo62HHJF4trQowqJJLWDXxPdMB1Hd')
const OWNER = new PublicKey(process.env.GD_SOL_OWNER || 'DwphVYwaepxGujRyd4yVBHrRqzHyqi4GuMNQ3LEZwmxX') // project owner (metadata only)
const RPC = process.env.CERT_SOLANA_RPC || 'https://api.devnet.solana.com'
if (/mainnet/.test(RPC) && process.env.GD_SOL_ALLOW_MAINNET !== '1') { console.error('Refusing mainnet.'); process.exit(1) }
const raw = JSON.parse(readFileSync(process.env.CERT_SOLANA_KEY_FILE || '/workspace/secure/gd-solana-issuer-devnet.cli.json', 'utf8'))
const issuer = Keypair.fromSecretKey(Uint8Array.from(Array.isArray(raw) ? raw : raw.secretKey))
const conn = new Connection(RPC, 'confirmed')
const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM)
const send = async (ix) => {
  const tx = new Transaction().add(ix)
  tx.feePayer = issuer.publicKey
  return conn.sendTransaction(tx, [issuer]).then(async (sig) => { await conn.confirmTransaction(sig, 'confirmed'); return sig })
}
const decodeConfig = (d) => ({ issuer: new PublicKey(d.subarray(2, 34)).toBase58(), owner: new PublicKey(d.subarray(34, 66)).toBase58(), count: d.readBigUInt64LE(66).toString() })

const action = process.env.GD_SOL_ACTION || 'status'
console.log('program', PROGRAM.toBase58(), '| config', config.toBase58(), '| issuer', issuer.publicKey.toBase58())
if (action === 'init') {
  const have = await conn.getAccountInfo(config)
  if (have) { console.log('config exists', decodeConfig(have.data)); process.exit(0) }
  const sig = await send(new TransactionInstruction({ programId: PROGRAM, data: Buffer.concat([Buffer.from([0]), OWNER.toBuffer()]), keys: [
    { pubkey: issuer.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] }))
  console.log('init tx', sig)
  console.log('config', decodeConfig((await conn.getAccountInfo(config)).data))
} else if (action === 'status') {
  const have = await conn.getAccountInfo(config)
  console.log(have ? decodeConfig(have.data) : 'config not initialised')
} else if (action === 'selftest') {
  // Through the server code path (api/_certSolana.ts), with a throwaway player; then closes the record again.
  process.env.CERT_SOLANA_SIGNER_KEY = JSON.stringify(Array.from(issuer.secretKey))
  process.env.VITE_CERT_SOLANA_PROGRAM = PROGRAM.toBase58(); process.env.CERT_SOLANA_RPC = RPC
  const sol = await import('../api/_certSolana.ts')
  const u = `gd-selftest-${Date.now()}`, d = { v: 2, n: 'Self test', u, c: 'spot', t: 'Spot trading', at: Date.now() }
  const r = await sol.issueOnSolana('SELFTEST', d)
  if (!r.ok) { console.error('issue failed', r); process.exit(1) }
  console.log('issue tx', r.tx, '| record', r.minted.explorer, '| serial', r.minted.tokenId)
  const addr = new PublicKey(await sol.certAddress(u, 'spot'))
  const acc = await conn.getAccountInfo(addr)
  const ok = acc.data[0] === 2 && acc.data.subarray(67, 99).equals(createHash('sha256').update('SELFTEST').digest()) && acc.data.subarray(35, 39).toString() === 'spot'
  console.log('on-chain fields match', ok)
  const again = await sol.issueOnSolana('SELFTEST', d)
  console.log('second issue is idempotent', again.ok && !again.tx)
  // A non-issuer cannot issue.
  const rogue = Keypair.generate()
  let refused = false
  try {
    const tx = new Transaction().add(new TransactionInstruction({ programId: PROGRAM, data: Buffer.concat([Buffer.from([1]), Buffer.alloc(128, 1)]), keys: [
      { pubkey: rogue.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: PublicKey.findProgramAddressSync([Buffer.from('cert'), Buffer.alloc(32, 1), createHash('sha256').update(Buffer.alloc(32, 1)).digest()], PROGRAM)[0], isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }] }))
    tx.feePayer = issuer.publicKey
    await conn.sendTransaction(tx, [issuer, rogue])
  } catch (e) { refused = /0x1770/.test(String(e?.message ?? e) + JSON.stringify(e?.logs ?? e?.transactionLogs ?? [])) }
  console.log('non-issuer refused', refused)
  if (process.env.GD_SOL_KEEP !== '1') {
    const sig = await send(new TransactionInstruction({ programId: PROGRAM, data: Buffer.from([4]), keys: [
      { pubkey: issuer.publicKey, isSigner: true, isWritable: true }, { pubkey: config, isSigner: false, isWritable: false }, { pubkey: addr, isSigner: false, isWritable: true }] }))
    console.log('cleanup (close) tx', sig, '| record gone', !(await conn.getAccountInfo(addr)))
  }
}
