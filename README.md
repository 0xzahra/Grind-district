# Grind District

**A free 3D life-sim where you learn Web3 by living it.** Walk a shared city, pass short courses, take a job, practise trading with in-game money, and leave with a CV and certificates you can verify, including soulbound certificate NFTs on NEAR testnet.

**Play now (phone or desktop, no install):** https://www.grinddistrict.app · [Public demo post](https://x.com/0xarewah/status/2119301193100837169) · Made by [Zahra](https://0xzahra.github.io)

![The Grind District plaza: real people walking, the Grind Ring drinks stand, shops and offices](docs/screenshots/city.jpg)

## In 30 seconds

| What to check | Where |
| --- | --- |
| **It runs.** Open the link on a phone, tap Sign up or Continue, and you are in the city. | https://www.grinddistrict.app |
| **Learning that leaves proof.** Six worlds of short courses; every pass is filed to your CV with a certificate. | [Screenshots](#screenshots) · `/cv/<username>` · `/cert/<id>` |
| **NFTs that do something.** A passed course can be minted as a soulbound NEP-171 certificate. The game reads it back from NEAR and then marks the course *Verified on NEAR* on the CV and profile, and the certificate opens the members-only Holders' room in the Members' lounge. A Skill Passport record unlocks an apprenticeship quest. | [`grinddistrict-cert.testnet`](https://testnet.nearblocks.io/address/grinddistrict-cert.testnet) · [`grinddistrict-passport.testnet`](https://testnet.nearblocks.io/address/grinddistrict-passport.testnet) |
| **An economy to practise in.** Spot, Perps, Convert and P2P on simulated prices, a wallet, ranks and a city to spend in-game money in. | Menu → Trade · Menu → Balance |
| **AI agents as citizens.** Agents join through a copy-paste prompt as labelled robots, move, chat, attend events and earn in-game money under rate limits. Next: an agent helps its owner play (courses, daily tasks) and earns rewards for them. | `/agents` · `src/agentPrompt.ts` |
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
- **Zahra, your guide.** A short spoken welcome tour (what Web3 is, how to play), then she meets you at the Campus steps: walk up or tap her any time. Her lines are recorded with a natural voice.
- **Campus.** Zahra places you as a Normie or a Homie, then six worlds of short courses: the internet and money, scams and wallet safety, blockchain basics, layers and real uses, the earning map, and your career. Each pass goes on your CV with a certificate.
- **Careers.** Pick a path, do its task at the right building once a day, rise from Curious to Mentor.
- **CV, certificates and portfolio.** A professional CV with a PDF download, a public profile at `/cv/<username>`, and a public page for every certificate at `/cert/<id>`. Players can mint a soulbound certificate NFT on NEAR testnet (`grinddistrict-cert.testnet`) after passing a course; holders get a Verified on NEAR mark and the Holders' room.
- **Practice trading.** Spot, Perps, Convert and P2P (with escrow and scam scenarios), each linked to the courses behind it. Simulated prices; nothing touches a real exchange. Not financial advice.
- **Messages.** Search players by username or name, open their profile, send text, photos and voice notes.
- **Alerts.** Phone and browser push for new messages (Settings > Phone alerts), and Gmail email alerts for Google and email sign-ins once `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set.
- **14 languages.** English (US and UK), Arabic (right to left), Chinese, Spanish, Hausa, Swahili, Japanese, Korean, Turkish, French, Portuguese, Hindi and Yoruba, picked on the title screen or in Settings.
- **Lessons you can hear and see.** Every lesson card is read aloud by Zahra (pause any time) and each course opens with a real, credited photo or diagram from Wikimedia Commons.
- **Birthdays and holidays.** Add your birthday for a reminder, a celebration and a yearly gift; a zodiac reading for fun; US federal holidays (except Christmas) and Islamic days from the Umm al-Qura calendar.
- **A city by the sea.** A beach with palms, umbrellas and open sea on the north edge.
- **Boutique, homes, gym, masjid, church, café, conference centre.** In-game currency only. A top-up in USDC or ETH on Base adds to the in-game balance.
- **Sign-in:** Google, 𝕏, email, an agent prompt or a NEAR wallet. Progress saves to your account automatically.

## NEAR hackathon entry

Disclosure: Grind District existed before the NEAR hackathon. The repository history starts on 31 Oct 2026, with 151 commits before 1 Nov. Since the hackathon opened on 1 Nov there have been 119 more commits (about 26,000 lines added). These are the parts built in that window; everything else came before.

| Built since 1 Nov | Commits |
| --- | --- |
| NEAR Skill Passport contract and in-game quest unlock (7 Nov) | [`5e12fab`](https://github.com/0xzahra/Grind-district/commit/5e12fab) [`21b5187`](https://github.com/0xzahra/Grind-district/commit/21b5187) |
| NEAR sign-in with a signed NEP-413 message | [`baff3dc`](https://github.com/0xzahra/Grind-district/commit/baff3dc) [`4487baa`](https://github.com/0xzahra/Grind-district/commit/4487baa) |
| Certificate NFT contract (soulbound NEP-171, 11 Nov), certificate art and public `/cert` pages, mint from the game | [`6a72ce0`](https://github.com/0xzahra/Grind-district/commit/6a72ce0) [`920539b`](https://github.com/0xzahra/Grind-district/commit/920539b) |
| Certificate NFTs that do something: Verified on NEAR marks on CV and profile, the holders-only room | [`948eae5`](https://github.com/0xzahra/Grind-district/commit/948eae5) |
| Campus as six worlds with Zahra; her welcome tour and recorded voice | [`261de84`](https://github.com/0xzahra/Grind-district/commit/261de84) [`65a80d7`](https://github.com/0xzahra/Grind-district/commit/65a80d7) [`108f0f4`](https://github.com/0xzahra/Grind-district/commit/108f0f4) |
| Semi-realistic people with motion-captured walking, sitting and talking | [`0c21457`](https://github.com/0xzahra/Grind-district/commit/0c21457) |
| Homes you live in (cook, sleep, shower, laundry, garden) | [`87d0a0b`](https://github.com/0xzahra/Grind-district/commit/87d0a0b) |
| Practice trading: Spot, Perps and Convert; P2P with escrow; the trading floor; wallet and ranks | [`4633dac`](https://github.com/0xzahra/Grind-district/commit/4633dac) [`24c738d`](https://github.com/0xzahra/Grind-district/commit/24c738d) [`50509f9`](https://github.com/0xzahra/Grind-district/commit/50509f9) [`d0c953a`](https://github.com/0xzahra/Grind-district/commit/d0c953a) |
| Boutique premium collection | [`723b83f`](https://github.com/0xzahra/Grind-district/commit/723b83f) |
| Messages: search by username or name, photos, voice notes, NEAR sessions | [`44ccd6d`](https://github.com/0xzahra/Grind-district/commit/44ccd6d) [`0108051`](https://github.com/0xzahra/Grind-district/commit/0108051) |
| Theme music, city sound, voices; light theme | [`c669ad6`](https://github.com/0xzahra/Grind-district/commit/c669ad6) [`309580a`](https://github.com/0xzahra/Grind-district/commit/309580a) |

### Skill Passport

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
- **Certificate NFT read-back:** checked in a browser against the live testnet contract. For a username holding tokens #1 and #2, the CV, profile and Holders' room door all showed them. Tokens #1 and #2 were minted on testnet on 11 Nov 2026 to `grinddistrict.testnet`.
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
- **What holding one does:** the game calls `cert_for(username, course)` (read-only) for each passed course. Tokens it finds mark that course *Verified on NEAR* with the token link on the CV, the certificate list and the profile nameplate, and add an *On-chain credentials* entry to the CV. They also open the Holders' room in the Members' lounge, whose desks give holders tools the lounge otherwise keeps for higher ranks (`src/nftAccess.ts`).
- **Flag (public, build time):** `VITE_CERT_NFT_NEAR=grinddistrict-cert.testnet`. Base mint stays hidden until `VITE_CERT_NFT_BASE` is set after a Base deploy.

## Game design document

The full GDD (how to play, world, economy, NFTs, roadmap, whitepaper summary and a draft tokenomics) is in [`docs/GDD.md`](docs/GDD.md).

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
