# NEAR hackathon entry: details

The short version is in the [README](../README.md). This page has the full list of what was built in the window, both contracts and the verification notes.

## Built since 1 Nov 2026

Baseline: commit [`39a1707`](https://github.com/0xzahra/Grind-district/commit/39a1707838b957b8542f9df282e8488a8cee575c), the last before 1 Nov 2026 00:00 UTC (116 commits). Everything after it, as one diff: [`39a1707...main`](https://github.com/0xzahra/Grind-district/compare/39a1707838b957b8542f9df282e8488a8cee575c...main). The submission is the last commit on `main` before 14 Nov 2026 23:59 UTC.

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
| Needs and mood; reputation as the only score | [`087fce1`](https://github.com/0xzahra/Grind-district/commit/087fce1) [`29d9cbe`](https://github.com/0xzahra/Grind-district/commit/29d9cbe) |
| Grind Pass premium season track; Featured bundles | [`0d7e94b`](https://github.com/0xzahra/Grind-district/commit/0d7e94b) [`19dd440`](https://github.com/0xzahra/Grind-district/commit/19dd440) |
| Wallet: banking layout, Assets / NFTs / Watchlist, rank road, ka-ching, private balances | [`ab87861`](https://github.com/0xzahra/Grind-district/commit/ab87861) [`a32be21`](https://github.com/0xzahra/Grind-district/commit/a32be21) [`60571ec`](https://github.com/0xzahra/Grind-district/commit/60571ec) |
| Makeup kit, sharper face, clothes on hangers, jewellery renders | [`0fe79d6`](https://github.com/0xzahra/Grind-district/commit/0fe79d6) [`3362203`](https://github.com/0xzahra/Grind-district/commit/3362203) |
| Hospital, casino front (gambling vs trading), shops on your street | [`9a6d43d`](https://github.com/0xzahra/Grind-district/commit/9a6d43d) |

Not part of the NEAR entry: the Base top-up (built before 1 Nov, Solidity in `contracts/` with an internal review in `contracts/AUDIT.md`) and the Stockholders' Club ([`BASE-STOCKS.md`](BASE-STOCKS.md)), a Base feature.

## Certificate NFTs

A soulbound (non-transferable) NEP-171 NFT for a course a signed-in player has passed. The player chooses to mint and pays the testnet network fee. One mint per player username and course.

- **Contract:** [`grinddistrict-cert.testnet`](https://testnet.nearblocks.io/address/grinddistrict-cert.testnet). Source in `near/cert-nft/` (Rust, MIT licence).
- **Deploy tx (11 Nov 2026):** [`71go32v1…`](https://testnet.nearblocks.io/txns/71go32v12mZtUs5mZMmvyrd1oRL8Zg3f5ZG2fgX6bZVS). Code hash `5paEq75bis1rXiNAJaivSHDzGjvgxo8dipLB8M5ucE5y`. Owner `grinddistrict-passport.testnet`.
- **Collection:** Grind District Certificate (`GDCERT`).
- **Metadata:** course name, player name and username, full timestamp, certificate id, issuer, chain, and a link to the public page at `https://www.grinddistrict.app/cert/<id>`.
- **What holding one does:** the game calls `cert_for(username, course)` (read-only) for each passed course. Tokens it finds mark that course *Verified on NEAR* with the token link on the CV, the certificate list and the profile nameplate, add an *On-chain credentials* entry to the CV, and open the Holders' room in the Members' lounge (`src/nftAccess.ts`).
- **Flag (public, build time):** `VITE_CERT_NFT_NEAR=grinddistrict-cert.testnet`.

## Skill Passport

- **Contract:** [`grinddistrict-passport.testnet`](https://testnet.nearblocks.io/address/grinddistrict-passport.testnet). Source in `near/skill-passport/` (Rust, MIT licence).
- **Deploy tx (7 Nov 2026):** [`D2eZH2pt…`](https://testnet.nearblocks.io/txns/D2eZH2ptLeMygwHjdkxA7byKLYyK2FN9jPjamUgTNoEh). Code hash `35oDvey4zKf6YD53Uz4vxvkEyTLoExfBTxoYPAavyo4i`. Owner `grinddistrict-passport.testnet`.
- **What it does:** after passing a course, a player can write a self-attested completion record from their own NEAR testnet account. The game reads it back from chain and only then unlocks an apprenticeship quest.
- **Methods:** `record_completion` (signed by the player), `get_completion`, `has_completed`, `list_completions`, `get_courses`, `passport_info`.
- **Courses (20, all version 1):** spot, risk, staking, airdrops, memes, agents, building, carbon, custody, stables, liquidity, records, wallets, explorer, scams, community, content, defi, nfts, daos.
- **Pass gate:** until a course is passed on the device, the Passport page shows no wallet panel and no save button.
- **Flags (public, build time):** `VITE_NEAR_PASSPORT=1` and `VITE_NEAR_PASSPORT_CONTRACT=grinddistrict-passport.testnet`. Without both, the feature stays hidden.
- **What it is not:** graded or accredited. No personal data goes on chain. Testnet only, no real money, and learning never needs a wallet.

## Verification status

- **Contracts:** 22 unit tests pass in `near/skill-passport` and 11 in `near/cert-nft` (`cargo test` in each). A read-only testnet check: `node near/skill-passport/check-testnet.mjs`.
- **Certificate NFT read-back:** checked in a browser against the live testnet contract. For a username holding tokens #1 and #2 (minted 11 Nov 2026 to `grinddistrict.testnet`), the CV, profile and Holders' room door all showed them.
- **Skill Passport:** Career → Spot checked in a desktop browser. Not verified end to end: wallet connect → save a passed course → read back → quest unlock.
- **Messages:** photos and voice notes not yet tested against the live database (text messages are in use).
- **Needs, Grind Pass, bundles, wallet, makeup kit and the new places:** checked in headless Chromium on a 390 × 844 phone screen. They keep their state on the device beside the save, so they do not follow an account to a new device yet.

Research on past NEAR winners and how this entry lines up: [`NEAR-HACKATHON-RESEARCH.md`](NEAR-HACKATHON-RESEARCH.md).
