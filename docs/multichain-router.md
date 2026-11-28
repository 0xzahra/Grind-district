# Multichain router (single source of truth)

The code version of this page is `src/chains/router.ts` (typed, no secrets, used by the game and the server).
If this page and that file disagree, the file wins and this page gets fixed.

Last checked on-chain: 28 Nov 2026.

## Routes

| Route | Network | Contract | Standard | Wallet | Gas | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `base` | Base mainnet (8453) | `0xBEC44b497b5D4696644A5ad581804476CB20808f` (`VITE_CERT_NFT_BASE`) | ERC-721 soulbound (ERC-5192), EIP-712 voucher | Privy EVM | Player pays; Builder Code `bc_ke1fy1yi` on the calldata; CDP Paymaster built but off | **Live** |
| `base-eas` | Base mainnet | EAS predeploy `0x4200…0021`, schema uid in `CERT_EAS_SCHEMA_UID` | EAS delegated attestation, alongside the NFT | Privy EVM | Player pays; Builder Code on the calldata | **Built, off** (schema not registered) |
| `near-testnet` | NEAR testnet | `grinddistrict-cert.testnet` (`VITE_CERT_NFT_NEAR`) | NEP-171 soulbound, ed25519 voucher | NEAR sign-in or connected NEAR wallet | Player attaches 0.05 NEAR storage (unused part refunded) | **Live**, stays live through hackathon judging |
| `near-mainnet` | NEAR mainnet | `cert.grinddistrict.near` (`VITE_CERT_NFT_NEAR_MAINNET`) | Same wasm as testnet (sha256 `479ea0e8…`) | NEAR mainnet wallet | Player attaches 0.05 NEAR storage | **Deployed, not live** (env not set, no game button yet) |
| `solana-devnet` | Solana devnet | `VITE_CERT_NFT_SOLANA` (Metaplex Core collection) | Core asset, co-signed by the update authority | Separate Solana address | Player pays | **Planned** (branch `solana-cert-devnet`, unmerged) |

Every course issues the same credential and routes to the same chains (`DEFAULT_ROUTES`). To pin a course to
other chains, add it to `COURSE_ROUTES` in `src/chains/router.ts`.

## Wallet model

- **EVM (Base, later BNB Chain / Robinhood Chain):** one Privy embedded wallet address, shared by every EVM chain.
  The server signs a Base voucher only for a wallet linked to the player's Privy account.
- **Solana:** a separate address (Privy Solana wallet or Phantom). Never derived from the EVM address.
- **NEAR:** the existing flow. Players who signed in with NEAR mint only to that account; others connect a NEAR
  wallet. Testnet accounts (`.testnet`) mint on testnet, mainnet accounts on mainnet.

## How a mint is gated (all routes)

1. The player passes the course in the game and then the short certificate exam, graded on the server. The pass is
   recorded in `cert_passes` and the player gets a short-lived pass ticket.
2. `POST /api/profile?op=cert-voucher` (`api/_certMint.ts`) checks sign-in, the server certificate record, the
   pass ticket, that the wallet is the player's own, and that this username and course is not minted yet on that
   contract. Only then does it sign a voucher for that one contract.
3. The contract checks the voucher signature, the contract it names, the receiver and the expiry, and mints at most
   one certificate per username and course. Tokens cannot be transferred or approved.

## Environment

| Variable | Where | Meaning |
| --- | --- | --- |
| `VITE_CERT_NFT_BASE`, `VITE_CERT_NFT_BASE_CHAIN` | build + server | Base contract and chain id (8453) |
| `CERT_SIGNER_PRIVATE_KEY` | server only | Base voucher signer (also the EAS attester) |
| `VITE_CERT_NFT_NEAR` | build + server | Main NEAR contract (testnet now) |
| `VITE_CERT_NFT_NEAR_MAINNET` | build + server | NEAR mainnet contract, alongside the main one. Unset = off |
| `CERT_NEAR_SIGNER_KEY` | server only | NEAR voucher signer (same public key on both NEAR contracts; vouchers name the contract, so they cannot be replayed across networks) |
| `CERT_NEAR_RPC`, `CERT_NEAR_MAINNET_RPC` | server | Optional RPC overrides |
| `CERT_EAS`, `CERT_EAS_SCHEMA_UID` | server | EAS on Base: both needed; the uid must equal the uid of `CERT_EAS_SCHEMA` |
| `VITE_GASLESS`, `CDP_PAYMASTER_URL` | build / server | CDP Paymaster gas-free route (both needed). Off |
| `VITE_CERT_NFT_SOLANA`, `VITE_CERT_NFT_SOLANA_CLUSTER` | build + server | Solana collection (branch only) |

## Turning a route on

- **NEAR mainnet:** set `VITE_CERT_NFT_NEAR_MAINNET=cert.grinddistrict.near` in Vercel production. The server then
  accepts `network: "mainnet"` on NEAR voucher requests. The game still mints on testnet until a mainnet choice is
  added to the mint dialog. Testnet keeps working either way.
- **EAS on Base:** register `CERT_EAS_SCHEMA` (revocable, no resolver) on the Base SchemaRegistry
  `0x4200…0020` (about 193,000 gas, roughly 0.0000012 ETH at 0.006 gwei), then set `CERT_EAS=1` and
  `CERT_EAS_SCHEMA_UID`. The voucher response then also carries a signed `attestByDelegation` request with the
  Builder Code appended; the game still needs a step to send it.
- **CDP Paymaster:** set `CDP_PAYMASTER_URL` (server) and build with `VITE_GASLESS=1`.

## Rollback

Every route is switched by env: unset the variable and redeploy (or promote the previous deployment in Vercel).
Contracts are never redeployed over: the testnet contract and `grinddistrict-passport.testnet` are left as they are.
Certificates already minted stay valid on their own chain.
