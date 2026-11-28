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
| `solana-devnet` | Solana devnet | Program `6NJLLRRTkvEwijjSo62HHJF4trQowqJJLWDXxPdMB1Hd` (`VITE_CERT_SOLANA_PROGRAM`), source `programs/grind-cert` | Grind District's own Rust program: issuer-only, soulbound certificate account (PDA per player and course) holding course id, certificate hash, serial and timestamp | None needed (optional Solana address recorded as recipient) | Server (issuer) pays the devnet test-SOL fee | **Live on devnet** (deployed 28 Nov 2026, deploy tx `44YTEs9w…`, config tx `4hXJqQ3c…`; server records a certificate after each exam pass; no game button) |

### Other EVM mainnets (28 Nov 2026)

Same `GrindCertificate` bytecode and settings as Base (signer `0x5c9a636347394E2381EfD107076B15269674d820`, base URI `https://www.grinddistrict.app/cert/`), deployed from the game deployer wallet. All five are at the same address, `0x6bC81E26832986d56B6e59c31599F3113971Ec33`. Source verified on Sourcify (exact match). Wired in `router.ts` (`EVM_CERT_CHAINS`): each chain shows in the mint picker once its `VITE_CERT_NFT_<KEY>` is set, and `/api/profile?op=cert-voucher` signs for it with the Base signer key (vouchers carry the chain id, so they cannot be replayed on another chain). Players pay gas in the chain's own token; no sponsorship. Robinhood Chain is added to Privy's chain list in `src/privyWallet.ts` (it is not in Privy's defaults).

| Chain | Chain id | Explorer | Owner today | Status |
| --- | --- | --- | --- | --- |
| OP Mainnet | 10 | https://optimistic.etherscan.io/address/0x6bC81E26832986d56B6e59c31599F3113971Ec33 | deployer wallet (temporary) | Live when env set |
| Arbitrum One | 42161 | https://arbiscan.io/address/0x6bC81E26832986d56B6e59c31599F3113971Ec33 | deployer wallet (temporary) | Live when env set |
| Robinhood Chain | 4663 | https://robinhoodchain.blockscout.com/address/0x6bC81E26832986d56B6e59c31599F3113971Ec33 | deployer wallet (temporary) | Live when env set |
| Polygon PoS | 137 | https://polygonscan.com/address/0x6bC81E26832986d56B6e59c31599F3113971Ec33 | deployer wallet (temporary) | Live when env set |
| BNB Chain | 56 | https://bscscan.com/address/0x6bC81E26832986d56B6e59c31599F3113971Ec33 | deployer wallet (temporary) | Live when env set |

Ownership is two-step (`transferOwnership`, then `acceptOwnership` by the new owner). The Safe `0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a` does not exist on these chains yet; it has to be created at the same address by its owner, then ownership handed over and accepted.

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
| `CERT_SIGNER_PRIVATE_KEY` | server only | EVM voucher signer for Base and the chains below (also the EAS attester on Base) |
| `VITE_CERT_NFT_ARBITRUM`, `VITE_CERT_NFT_OPTIMISM`, `VITE_CERT_NFT_ROBINHOOD`, `VITE_CERT_NFT_POLYGON`, `VITE_CERT_NFT_BSC` | build + server | Contract on that chain. Unset = that chain off |
| `CERT_RPC_ARBITRUM`, `CERT_RPC_OPTIMISM`, `CERT_RPC_ROBINHOOD`, `CERT_RPC_POLYGON`, `CERT_RPC_BSC` | server | Optional RPC overrides (server reads only; the browser uses public RPCs) |
| `VITE_CERT_NFT_NEAR` | build + server | Main NEAR contract (testnet now) |
| `VITE_CERT_NFT_NEAR_MAINNET` | build + server | NEAR mainnet contract, alongside the main one. Unset = off |
| `CERT_NEAR_SIGNER_KEY` | server only | NEAR voucher signer (same public key on both NEAR contracts; vouchers name the contract, so they cannot be replayed across networks) |
| `CERT_NEAR_RPC`, `CERT_NEAR_MAINNET_RPC` | server | Optional RPC overrides |
| `CERT_EAS`, `CERT_EAS_SCHEMA_UID` | server | EAS on Base: both needed; the uid must equal the uid of `CERT_EAS_SCHEMA` |
| `VITE_GASLESS`, `CDP_PAYMASTER_URL` | build / server | CDP Paymaster gas-free route (both needed). Off |
| `VITE_CERT_SOLANA_PROGRAM` | build + server | grind-cert program id. Unset = Solana off |
| `CERT_SOLANA_SIGNER_KEY` | server only | Issuer keypair (64-byte JSON array). Never in the repo |
| `CERT_SOLANA_AUTO` | server | `1` = record each newly issued certificate on Solana (after the exam pass) |
| `CERT_SOLANA_CLUSTER`, `CERT_SOLANA_RPC` | server | `devnet` (default) and an optional RPC override |

## Turning a route on

- **NEAR mainnet:** set `VITE_CERT_NFT_NEAR_MAINNET=cert.grinddistrict.near` in Vercel production. The server then
  accepts `network: "mainnet"` on NEAR voucher requests. The game still mints on testnet until a mainnet choice is
  added to the mint dialog. Testnet keeps working either way.
- **EAS on Base:** register `CERT_EAS_SCHEMA` (revocable, no resolver) on the Base SchemaRegistry
  `0x4200…0020` (about 193,000 gas, roughly 0.0000012 ETH at 0.006 gwei), then set `CERT_EAS=1` and
  `CERT_EAS_SCHEMA_UID`. The voucher response then also carries a signed `attestByDelegation` request with the
  Builder Code appended; the game still needs a step to send it.
- **CDP Paymaster:** set `CDP_PAYMASTER_URL` (server) and build with `VITE_GASLESS=1`.

- **Solana (devnet):** deploy `programs/grind-cert` (`cargo build-sbf`, `solana program deploy`), run
  `GD_SOL_ACTION=init node --experimental-strip-types --import ./scripts/ts-hooks.mjs scripts/solana-cert.mjs` once
  (records the issuer and the project owner address `DwphVYwaepxGujRyd4yVBHrRqzHyqi4GuMNQ3LEZwmxX`, metadata only), then
  set `VITE_CERT_SOLANA_PROGRAM`, `CERT_SOLANA_SIGNER_KEY` and `CERT_SOLANA_AUTO=1`. The server then writes a certificate
  record on Solana when it issues a certificate after a passed exam (`op=cert-issue`), and `op=cert-voucher` with
  `chain: "solana"` does the same on request (pass ticket needed). The public certificate page shows *Recorded on
  Solana*. There is no Solana button in the mint dialog; adding one is a UI change. `GD_SOL_ACTION=selftest` issues
  and then closes a throwaway record through the server code.

## Rollback

Every route is switched by env: unset the variable and redeploy (or promote the previous deployment in Vercel).
Contracts are never redeployed over: the testnet contract and `grinddistrict-passport.testnet` are left as they are.
Certificates already minted stay valid on their own chain.
