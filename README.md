# Grind District

Millions of people want to work in Web3, but they learn from scattered videos, get scammed on the way, and end up with nothing that proves what they know.

**Grind District** is a free 3D city where you learn Web3 by living it. Every lesson you pass becomes proof: a CV, a certificate, and a soulbound certificate NFT on NEAR that the game reads back to unlock things.

**Play (phone or desktop, no install):** https://www.grinddistrict.app · [Demo post](https://x.com/0xarewah/status/2119301193100837169) · Made by [Zahra](https://0xzahra.github.io)

![The Grind District plaza: people walking, the Grind Ring drinks stand, shops and offices](docs/screenshots/city.jpg)

## Try the NEAR flow (about 3 minutes)

1. **Learn.** Open [grinddistrict.app](https://www.grinddistrict.app), sign in (NEAR wallet, Google, X or email), walk to Campus and pass a one-minute lesson with Zahra.
2. **Prove.** The pass goes on your CV with a certificate (Profile > Certificates), each with a public page.
3. **Mint on NEAR.** Open the certificate and tap *Mint as NFT* > NEAR. A soulbound NEP-171 token is minted on [`grinddistrict-cert.testnet`](https://testnet.nearblocks.io/address/grinddistrict-cert.testnet) to your NEAR testnet account (0.05 NEAR attached for storage).
4. **See it do something.** The game calls `cert_for(username, course)` and marks that course *Verified on NEAR* on your CV and profile, and the members-only **Holders' room** in the Members' lounge opens.
5. **Check it anywhere.** The certificate's public page reads the chain too: [this certificate](https://www.grinddistrict.app/cert/eyJ2IjoyLCJuIjoiMHh6YXJhIiwidSI6InphcmEiLCJyIjoiQ3JhYiIsImMiOiJpbnRlcm5ldCIsInQiOiJXaGF0IHRoZSBpbnRlcm5ldCBpcyIsImQiOiIyMDI2LTExLTEwIiwiYXQiOjE3OTQzMzc0MjE1NDJ9) shows *Minted on NEAR · [Token #1](https://testnet.nearblocks.io/nft-token/grinddistrict-cert.testnet/1)*.

| Certificate | Verified on NEAR | Holders' room |
| --- | --- | --- |
| ![Certificate of completion](docs/screenshots/certificate.jpg) | ![Profile nameplate marked Verified on NEAR](docs/screenshots/profile-verified.jpg) | ![The Holders' room door in the Members' lounge](docs/screenshots/holders-room.jpg) |

## NEAR hackathon entry

| | |
| --- | --- |
| **Tracks** | Games With Real Economies · NFTs That Do Something · Agent Economy |
| **Contracts** | [`grinddistrict-cert.testnet`](https://testnet.nearblocks.io/address/grinddistrict-cert.testnet): soulbound certificate NFTs, 11 tests. [`grinddistrict-passport.testnet`](https://testnet.nearblocks.io/address/grinddistrict-passport.testnet): Skill Passport, 22 tests. Rust, MIT. |
| **Proof it ran** | Tokens [#1](https://testnet.nearblocks.io/nft-token/grinddistrict-cert.testnet/1) and [#2](https://testnet.nearblocks.io/nft-token/grinddistrict-cert.testnet/2), minted 11 Nov 2026, read back by the game |
| **Built in the window** | Everything since baseline commit `39a1707` (1 Nov 2026): [one diff](https://github.com/0xzahra/Grind-district/compare/39a1707838b957b8542f9df282e8488a8cee575c...main). The full list with commits and both contracts is in [`docs/NEAR-ENTRY.md`](docs/NEAR-ENTRY.md). |
| **Disclosure** | An existing project: 116 commits came before 1 Nov. Pre-existing product on another chain: the in-game top-up on Base, which is not part of this entry. All NEAR work was built in the window. The submission is the last commit before 14 Nov 2026 23:59 UTC. |

## What's in the game

- **Campus:** six worlds of one-minute lessons with Zahra, a voiced guide. Each pass is filed to a CV with a certificate.
- **A life in the city:** a home to cook, sleep and shower in, needs that fall while you play, shops, a hospital, jobs and a season with a Grind Pass. Reputation is the only score.
- **Practice trading:** Spot, Perps, Convert and P2P on simulated prices, with scam scenarios. Practice money only.
- **Social:** players and residents in one city, nearby chat, messages, and AI agents as labelled citizens.
- **Tokenized stocks:** the Stockholders' Club opens for players who hold a stock token on Base ([how it works](docs/BASE-STOCKS.md)).
- **14 languages**, phone first, Low, Medium and High graphics.

## Screenshots

| Campus | Zahra's tour | CV |
| --- | --- | --- |
| ![Campus: worlds, missions and progress](docs/screenshots/campus.jpg) | ![Zahra's welcome tour](docs/screenshots/zahra-tour.jpg) | ![A professional CV built from what the player completed](docs/screenshots/cv.jpg) |

| Trade | Trading floor | Wallet |
| --- | --- | --- |
| ![Spot, Perps, Convert and P2P on practice prices](docs/screenshots/trade.jpg) | ![The trading floor: crypto chart wall and desks](docs/screenshots/trading-floor.jpg) | ![Wallet: balance, actions, assets, NFTs and watchlist](docs/screenshots/wallet.jpg) |

| Needs and mood | Grind Pass | Rank road |
| --- | --- | --- |
| ![Energy, hunger, hygiene and social](docs/screenshots/needs.jpg) | ![Grind Pass: free and premium tracks](docs/screenshots/grind-pass.jpg) | ![Ranks as medallions from shrimp to whale](docs/screenshots/ranks.jpg) |

| Home | Plaza | Your street |
| --- | --- | --- |
| ![A home you live in: gas cooker, fridge, utensils](docs/screenshots/home.jpg) | ![The Grind Ring stand with its server](docs/screenshots/plaza.jpg) | ![Corner store and pharmacy by your home](docs/screenshots/street.jpg) |

| Boutique | Clothes on the rails | Fine jewellery |
| --- | --- | --- |
| ![Boutique: free clothes and the runway collection](docs/screenshots/boutique.jpg) | ![Garments on wooden hangers](docs/screenshots/boutique-racks.jpg) | ![Studio renders of necklaces and rings](docs/screenshots/jewellery.jpg) |

| Makeup kit | Zahra at Campus | The casino front |
| --- | --- | --- |
| ![Lipstick, blush, eyeshadow and liner](docs/screenshots/makeup.jpg) | ![Zahra at the Campus steps](docs/screenshots/zahra-campus.jpg) | ![Closed for good: gambling vs trading](docs/screenshots/casino.jpg) |

The full design is in the [GDD](docs/GDD.md).

## Run from source

Node 22 or newer. Rust with `cargo` for the contract tests.

| Do | You should see |
| --- | --- |
| `npm ci` then `npm run build` | `tsc` passes, each check script prints `ok` lines, then `✓ built` |
| `node tests/career-lessons.check.mjs` | Two `ok` lines |
| `cd near/skill-passport && cargo test` | `test result: ok. 22 passed` |
| `cd near/cert-nft && cargo test` | `test result: ok. 11 passed` |
| `node near/skill-passport/check-testnet.mjs` | The live contract's info from NEAR testnet, then `OK` |
| `npm run dev`, open the local address, then run `window.dispatchEvent(new Event('gd-enter-city'))` in the console | The city opens in about 10 seconds |

Sign-in, cloud save and Messages need Privy and Supabase keys, which are not in the repository (see `.env.example`). Without them, the console line opens the city with a local save. The full game, including minting, is at https://www.grinddistrict.app.

## Libraries and licence

No starter template was used. Libraries: [three](https://threejs.org), [near-sdk](https://crates.io/crates/near-sdk) (Rust), [@hot-labs/near-connect](https://www.npmjs.com/package/@hot-labs/near-connect), [Privy](https://www.npmjs.com/package/@privy-io/js-sdk-core), [Supabase](https://www.npmjs.com/package/@supabase/supabase-js), [viem](https://viem.sh) and [ox](https://oxlib.sh), [@vercel/og](https://www.npmjs.com/package/@vercel/og), [@napi-rs/canvas](https://www.npmjs.com/package/@napi-rs/canvas), [web-push](https://www.npmjs.com/package/web-push), [nodemailer](https://www.npmjs.com/package/nodemailer), [qrcode-generator](https://www.npmjs.com/package/qrcode-generator), [Fontsource](https://fontsource.org), [glTF Transform](https://gltf-transform.dev), [meshoptimizer](https://github.com/zeux/meshoptimizer), [sharp](https://sharp.pixelplumbing.com), [Vite](https://vite.dev) and [TypeScript](https://www.typescriptlang.org). Third-party art is listed in [`CREDITS.md`](CREDITS.md).

Licence: [MIT](LICENSE) for all code, including the NEAR contracts. Third-party art keeps its own licences; the name, logo, music and voices are not covered.
