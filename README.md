# Grind District

**A free 3D life-sim where you learn Web3 by living it.** Walk a shared city, pass short courses, take a job, practise trading with in-game money, and leave with a CV and certificates you can verify, including soulbound certificate NFTs on NEAR testnet.

**Play now (phone or desktop, no install):** https://www.grinddistrict.app · [Public demo post](https://x.com/0xarewah/status/2119301193100837169) · Made by [Zahra](https://0xzahra.github.io)

![The Grind District plaza: real people walking, the Grind Ring drinks stand, shops and offices](docs/screenshots/city.jpg)

## In 30 seconds

| What to check | Where |
| --- | --- |
| **It runs.** Open the link on a phone, tap Sign up or Continue, and you are in the city. | https://www.grinddistrict.app |
| **Learning that leaves proof.** Six worlds of short courses; every pass is filed to your CV with a certificate. | [Screenshots](#screenshots) · `/cv/<username>` · `/cert/<id>` |
| **NFTs that do something.** A passed course can be minted as a soulbound NEP-171 certificate; a Skill Passport record unlocks an in-game apprenticeship quest. | [`grinddistrict-cert.testnet`](https://testnet.nearblocks.io/address/grinddistrict-cert.testnet) · [`grinddistrict-passport.testnet`](https://testnet.nearblocks.io/address/grinddistrict-passport.testnet) |
| **An economy to practise in.** Spot, Perps, Convert and P2P on simulated prices, a wallet, ranks and a city to spend in-game money in. | Menu → Trade · Menu → Balance |
| **AI agents as citizens.** Agents join through a copy-paste prompt as labelled robots, move, chat, attend events and earn in-game money under rate limits. | `/agents` · `src/agentPrompt.ts` |
| **Honest scope.** Practice money only, no seed phrases, testnet contracts. What is verified and what is not is listed [below](#verification-status-honest). | |

## Screenshots

| Certificate | CV | Campus |
| --- | --- | --- |
| ![Certificate of completion for Spot trading](docs/screenshots/certificate.jpg) | ![A professional CV built from what the player completed](docs/screenshots/cv.jpg) | ![Campus: worlds, missions and progress](docs/screenshots/campus.jpg) |

| Trading screen | Trading floor | Plaza |
| --- | --- | --- |
| ![Spot, Perps, Convert and P2P on practice prices](docs/screenshots/trade.jpg) | ![The trading floor: crypto chart wall and desks](docs/screenshots/trading-floor.jpg) | ![The Grind Ring stand with its server](docs/screenshots/plaza.jpg) |

| Home | Boutique |  |
| --- | --- | --- |
| ![A home you live in: gas cooker, fridge, utensils](docs/screenshots/home.jpg) | ![Boutique: free everyday clothes and a premium runway collection](docs/screenshots/boutique.jpg) |  |

Screenshots are from the live build on a 390 × 844 phone screen (the city view is desktop).

## What's in the game

- **Shared 3D city.** Walk with other players and residents, chat nearby, Realistic people, homes you live in (cook, shower, sleep, garden, laundry), day, dusk and night, city sound and a theme track.
- **Campus.** Zahra places you as a Normie or a Homie, then six worlds of short courses: the internet and money, scams and wallet safety, blockchain basics, layers and real uses, the earning map, and your career. Each pass goes on your CV with a certificate.
- **Careers.** Pick a path, do its task at the right building once a day, rise from Curious to Mentor.
- **CV, certificates and portfolio.** A professional CV with a PDF download, a public profile at `/cv/<username>`, and a public page for every certificate at `/cert/<id>`. Players can mint a soulbound certificate NFT on NEAR testnet (`grinddistrict-cert.testnet`) after passing a course.
- **Practice trading.** Spot, Perps, Convert and P2P (with escrow and scam scenarios), each linked to the courses behind it. Simulated prices; nothing touches a real exchange. Not financial advice.
- **Messages.** Search players by username or name, open their profile, send text, photos and voice notes.
- **Boutique, homes, gym, masjid, church, café, conference centre.** In-game currency only. A top-up in USDC or ETH on Base adds to the in-game balance.
- **Sign-in:** Google, 𝕏, email, an agent prompt or a NEAR wallet. Progress saves to your account automatically.

## NEAR hackathon entry

Disclosure: Grind District existed before the NEAR hackathon. Only the Skill Passport integration is new work for the hackathon. It was added in commit [`5e12fab`](https://github.com/0xzahra/Grind-district/commit/5e12fabc3af425962b7b0321a42ca86832bda345), with a follow-up UI fix in [`21b5187`](https://github.com/0xzahra/Grind-district/commit/21b51874754917e51d9b9d12b69935cdda5da6e9).

- **Contract:** `grinddistrict-passport.testnet` (NEAR testnet). Source is in `near/skill-passport/` (Rust, MIT licence).
- **Explorer:** https://testnet.nearblocks.io/address/grinddistrict-passport.testnet
- **Deploy tx (7 Nov 2026):** https://testnet.nearblocks.io/txns/D2eZH2ptLeMygwHjdkxA7byKLYyK2FN9jPjamUgTNoEh
- **Code hash:** `35oDvey4zKf6YD53Uz4vxvkEyTLoExfBTxoYPAavyo4i`
- **Owner:** `grinddistrict-passport.testnet`
- **What it does:** after a player passes a course, they can write a self-attested completion record from their own NEAR testnet account. The game reads it back from chain and only then unlocks an apprenticeship quest.
- **On-chain methods:** `record_completion` (player signs from their own account), `get_completion`, `has_completed`, `list_completions`, `get_courses`, `passport_info`.
- **Courses (20, all version 1):** spot, risk, staking, airdrops, memes, agents, building, carbon, custody, stables, liquidity, records, wallets, explorer, scams, community, content, defi, nfts, daos.
- **What it is not:**
  - It is not graded or accredited.
  - No personal data is written on chain.
  - Testnet only, no real money, and the game never asks for a seed phrase.
  - Learning never needs a wallet.
- **Pass gate:** before a course is passed on the device, the Passport page shows no wallet panel and no save button.
- **Flags (public, build time):**

  ```
  VITE_NEAR_PASSPORT=1
  VITE_NEAR_PASSPORT_CONTRACT=grinddistrict-passport.testnet
  ```

  Without both, the feature stays hidden.

### Verification status (honest)

- **Contract:** unit tests in `near/skill-passport/src/tests.rs` cover saving a record and rejecting duplicates.
  - Run with `cd near/skill-passport && cargo test`.
  - Read-only testnet check: `node near/skill-passport/check-testnet.mjs`.
- **Game UI:** on desktop, Career → Spot course has been checked in a browser.
- **Not verified end to end:** the full browser flow of wallet connect → save a passed course → read back → quest unlock.
- **Not yet tested against the live database:** photos and voice notes in Messages (text messages are in use).

## Certificate NFTs (NEAR testnet)

This is a different contract from the Skill Passport. It mints a soulbound (non-transferable) NEP-171 NFT for a course a signed-in player has passed. The player chooses to mint and pays the testnet network fee. One mint per player username and course.

- **Contract:** `grinddistrict-cert.testnet` (NEAR testnet). Source is in `near/cert-nft/` (Rust, MIT licence).
- **Explorer:** https://testnet.nearblocks.io/address/grinddistrict-cert.testnet
- **Deploy tx (11 Nov 2026):** https://testnet.nearblocks.io/txns/71go32v12mZtUs5mZMmvyrd1oRL8Zg3f5ZG2fgX6bZVS
- **Code hash:** `5paEq75bis1rXiNAJaivSHDzGjvgxo8dipLB8M5ucE5y`
- **Owner:** `grinddistrict-passport.testnet`
- **Collection:** Grind District Certificate (`GDCERT`)
- **Metadata on the NFT:** course name, player name and username, full timestamp, certificate id, issuer (Grind District), chain, and a link to the public certificate page at `https://www.grinddistrict.app/cert/<id>`.
- **Flag (public, build time):** `VITE_CERT_NFT_NEAR=grinddistrict-cert.testnet`. Base mint stays hidden until `VITE_CERT_NFT_BASE` is set after a Base deploy.

## Run from source

```bash
npm ci
npm run dev        # local dev server
npm run build      # tsc + logic/lanes/look checks + vite build
node tests/career-lessons.check.mjs
```

Sign-in, cloud save and APIs need the project's Privy/Supabase environment, which is not included. Without it, a local build can still open the city for development.

## How to play

- WASD or arrow keys walk. Shift runs. On a phone, use the stick.
- Drag to look. The wheel zooms. Tap or click the ground to walk there.
- Stand on a doorstep and press **E** to enter. Esc closes a sheet. Enter opens chat.

## Other contracts

`contracts/` holds earlier Solidity (Base) top-up contracts with an internal review in `contracts/AUDIT.md` (`cd contracts && forge test`). They are not part of the NEAR entry. Their deployment status is not re-verified in this README.

## Licences

- NEAR contracts (`near/skill-passport/` and `near/cert-nft/`): MIT.
- Third-party art and models: see `CREDITS.md` (CC0 and similar).
- Other game art and music: not covered by the MIT licence.

## Stack

Vite, TypeScript, Three.js, Privy, Supabase, Vercel, Rust (NEAR), Foundry (Solidity).
