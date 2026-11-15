# Moving the certificate contract to NEAR mainnet

The game, the server and the public certificate page already follow the contract named in `VITE_CERT_NFT_NEAR`: a name ending in `.testnet` uses NEAR testnet, anything else uses NEAR mainnet (RPC, explorer links, wallet network and the `cert_for` read-back all switch together). Moving to mainnet takes three steps, and only the owner can do them, because they need a funded mainnet wallet. Nothing in this repository holds a key.

What it costs: about 3 NEAR to the contract account for its storage (the contract is small), plus a little gas. Each player then attaches 0.05 NEAR when they mint (storage for their token; the unused part is refunded).

## 1. Build the contract

```bash
cd near/cert-nft && cargo near build non-reproducible-wasm
```

The file is `near/cert-nft/target/near/grind_cert_nft.wasm`. The same code is on testnet as `grinddistrict-cert.testnet` (11 tests: `cargo test`).

## 2. Create the account, deploy and initialise

Use a sub-account of your own mainnet account, for example `cert.YOURNAME.near`. With [near-cli-rs](https://github.com/near/near-cli-rs), signed in to your own account on this machine:

```bash
near account create-account fund-myself cert.YOURNAME.near '3 NEAR' autogenerate-new-keypair save-to-keychain sign-as YOURNAME.near network-config mainnet sign-with-keychain send
```

Get the signer's public key. This is the same signer key the server already uses for testnet vouchers. The script prints only the public half:

```bash
CERT_NEAR_SIGNER_KEY='(the value from Vercel)' node --experimental-strip-types --import ./scripts/ts-hooks.mjs scripts/near-signer-pubkey.ts
```

Deploy and initialise in one transaction (put the printed `ed25519:...` key in `signer_pk`):

```bash
near contract deploy cert.YOURNAME.near use-file near/cert-nft/target/near/grind_cert_nft.wasm with-init-call new json-args '{"owner_id":"YOURNAME.near","signer_pk":"ed25519:PASTE","base_uri":"https://www.grinddistrict.app/cert/"}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send
```

Check it:

```bash
near contract call-function as-read-only cert.YOURNAME.near nft_metadata json-args '{}' network-config mainnet now
```

## 3. Point the game at it

In the Vercel project settings, set `VITE_CERT_NFT_NEAR=cert.YOURNAME.near` and redeploy. The mint screen then says *NEAR* instead of *NEAR (testnet)*, minting asks for a mainnet wallet, the city stats say *Mints on NEAR*, and the README's `near view` commands work with `--networkId mainnet`.

Certificates already minted on testnet stay on testnet. Players can mint again on mainnet; each mint still needs a pass on the server-graded exam.
