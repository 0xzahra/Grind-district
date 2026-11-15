// Prints the PUBLIC key of the certificate signer (from CERT_NEAR_SIGNER_KEY in your environment), for the
// contract's `signer_pk` when you deploy the certificate contract to NEAR mainnet. Never prints the secret.
// Run: CERT_NEAR_SIGNER_KEY=... node --experimental-strip-types --import ./scripts/ts-hooks.mjs scripts/near-signer-pubkey.ts
import { nearSignerPublicKey } from '../api/_certVoucher.ts'
const secret = process.env.CERT_NEAR_SIGNER_KEY
if (!secret) { console.error('Set CERT_NEAR_SIGNER_KEY in your environment first (the same value as on Vercel).'); process.exit(1) }
console.log(nearSignerPublicKey(secret))
