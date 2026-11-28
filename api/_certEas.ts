// Optional EAS attestation on Base for a certificate, ALONGSIDE the soulbound NFT. Underscore = not a Vercel function.
// OFF unless CERT_EAS=1 and CERT_EAS_SCHEMA_UID is the uid of CERT_EAS_SCHEMA (registered once on Base's
// SchemaRegistry, about 0.0000012 ETH of gas). The server only signs a *delegated* attestation inside the same
// certificate voucher path (exam pass + linked wallet + not yet minted, api/_certMint.ts); the player submits
// attestByDelegation from their own wallet and pays the gas, with the Builder Code appended to the calldata.
// The attester is the certificate signer address, so anyone can check an attestation came from the game.
import { encodeAbiParameters, encodeFunctionData, encodePacked, keccak256, type Hex } from 'viem'
import { certSerial, type CertData } from './_certArt.js'
import { VOUCHER_TTL_S } from './_certVoucher.js'
import { withBuilderCode } from '../src/builderCode.js'

export const EAS_BASE = '0x4200000000000000000000000000000000000021' as const
export const SCHEMA_REGISTRY_BASE = '0x4200000000000000000000000000000000000020' as const
/** Base predeploy EAS: getName() = "EAS", EIP-712 domain version "1.3.0" (checked against getDomainSeparator()). */
export const EAS_DOMAIN = { name: 'EAS', version: '1.3.0', chainId: 8453, verifyingContract: EAS_BASE } as const
/** Public fields only: no player name or email. The recipient is the player's wallet. */
export const CERT_EAS_SCHEMA = 'string username,string courseId,string courseTitle,string certId,string serial,uint64 issuedAt'
export const CERT_EAS_REVOCABLE = true
const ZERO = '0x0000000000000000000000000000000000000000' as const
const Z32 = ('0x' + '00'.repeat(32)) as Hex

/** SchemaRegistry uid: keccak256(abi.encodePacked(schema, resolver, revocable)). */
export const schemaUid = (schema = CERT_EAS_SCHEMA, resolver: Hex = ZERO, revocable = CERT_EAS_REVOCABLE): Hex =>
  keccak256(encodePacked(['string', 'address', 'bool'], [schema, resolver, revocable]))

export const easLive = () => process.env.CERT_EAS === '1' && (process.env.CERT_EAS_SCHEMA_UID ?? '').toLowerCase() === schemaUid().toLowerCase()

export const ATTEST_TYPES = {
  Attest: [
    { name: 'attester', type: 'address' }, { name: 'schema', type: 'bytes32' }, { name: 'recipient', type: 'address' },
    { name: 'expirationTime', type: 'uint64' }, { name: 'revocable', type: 'bool' }, { name: 'refUID', type: 'bytes32' },
    { name: 'data', type: 'bytes' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint64' },
  ],
} as const

export const ATTEST_BY_DELEGATION_ABI = [{
  type: 'function', name: 'attestByDelegation', stateMutability: 'payable', outputs: [{ type: 'bytes32' }],
  inputs: [{ name: 'delegatedRequest', type: 'tuple', components: [
    { name: 'schema', type: 'bytes32' },
    { name: 'data', type: 'tuple', components: [
      { name: 'recipient', type: 'address' }, { name: 'expirationTime', type: 'uint64' }, { name: 'revocable', type: 'bool' },
      { name: 'refUID', type: 'bytes32' }, { name: 'data', type: 'bytes' }, { name: 'value', type: 'uint256' }] },
    { name: 'signature', type: 'tuple', components: [{ name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }] },
    { name: 'attester', type: 'address' }, { name: 'deadline', type: 'uint64' }] }],
}] as const

export const encodeCertAttestation = (id: string, d: CertData): Hex => encodeAbiParameters(
  [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'uint64' }],
  [d.u.toLowerCase(), d.c, d.t, id, certSerial(d), BigInt(Math.floor((d.at ?? Date.now()) / 1000))],
)

async function attesterNonce(attester: Hex): Promise<bigint> {
  const data = encodeFunctionData({ abi: [{ type: 'function', name: 'getNonce', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'getNonce', args: [attester] })
  const r = await fetch(process.env.CERT_BASE_RPC || 'https://mainnet.base.org', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: EAS_BASE, data }, 'latest'] }) })
  const j = (await r.json()) as { result?: Hex }
  if (!j.result) throw new Error('Base RPC error')
  return BigInt(j.result)
}

/** Signed delegated-attestation request plus ready calldata (Builder Code appended) for the player's wallet. */
export async function easAttestationRequest(key: Hex, recipient: Hex, id: string, d: CertData, opts: { nonce?: bigint; now?: number; schema?: Hex } = {}) {
  const { privateKeyToAccount } = await import('viem/accounts')
  const signer = privateKeyToAccount(key)
  const schema = opts.schema ?? schemaUid()
  const nonce = opts.nonce ?? await attesterNonce(signer.address)
  const deadline = BigInt(Math.floor((opts.now ?? Date.now()) / 1000) + VOUCHER_TTL_S)
  const data = encodeCertAttestation(id, d)
  const message = { attester: signer.address, schema, recipient, expirationTime: 0n, revocable: CERT_EAS_REVOCABLE, refUID: Z32, data, value: 0n, nonce, deadline }
  const sig = await signer.signTypedData({ domain: EAS_DOMAIN, types: ATTEST_TYPES, primaryType: 'Attest', message })
  const r = `0x${sig.slice(2, 66)}` as Hex, s = `0x${sig.slice(66, 130)}` as Hex, v = parseInt(sig.slice(130, 132), 16)
  const calldata = withBuilderCode(encodeFunctionData({ abi: ATTEST_BY_DELEGATION_ABI, functionName: 'attestByDelegation', args: [{
    schema, data: { recipient, expirationTime: 0n, revocable: CERT_EAS_REVOCABLE, refUID: Z32, data, value: 0n }, signature: { v, r, s }, attester: signer.address, deadline,
  }] }))
  return { to: EAS_BASE, chainId: 8453, schema, attester: signer.address, nonce: nonce.toString(), deadline: deadline.toString(), calldata }
}
