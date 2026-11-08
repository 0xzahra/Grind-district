# Grind District

**Build skills. Create proof.** A free browser life-simulation game: explore a shared 3D city, choose a career, learn skills through short lessons and challenges, and build a CV and portfolio from what you complete.

- **Play:** https://grinddistrict.vercel.app
- **Public demo post:** https://x.com/0xarewah/status/2119301193100837169
- Made by [Zahra](https://0xzahra.github.io).

## What's in the game

- **Shared 3D city.** Walk with other players, chat nearby, see names and ranks.
- **Career & Lessons.** Career opens on Lessons: 20 courses, each with a status (Passed / Up next / Not started) and Start/Review. Careers lists the lessons for each path. Courses are taught on Campus.
- **CV, certificates and portfolio.** Each pass is filed to your CV with a certificate. Public profile and share card at `/cv/<username>`.
- **Practice trading.** In-game practice funds only. Not real money, not financial advice.
- **Boutique, gadgets, houses, gym, cafés, plaza.** In-game currency only.
- **Sign-in:** email code through Privy. Guests can play and keep progress on their device.
- **Optional NEAR testnet Skill Passport** (below).

## NEAR Skill Passport (testnet, optional)

Disclosure: Grind District existed before the NEAR hackathon. Only the Skill Passport integration is new work for the hackathon. It was added in commit [`5e12fab`](https://github.com/0xzahra/Grind-district/commit/5e12fabc3af425962b7b0321a42ca86832bda345), with a follow-up UI fix in [`21b5187`](https://github.com/0xzahra/Grind-district/commit/21b51874754917e51d9b9d12b69935cdda5da6e9).

- **Contract:** `grinddistrict-passport.testnet` (NEAR testnet). Source is in `near/skill-passport/` (Rust, MIT licence).
- **What it does:** after a player passes a course, they can write a self-attested completion record from their own NEAR testnet account. The game reads it back from chain and only then unlocks an apprenticeship quest.
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
- **Known issues:** movement, camera and textures still need work. A separate camera patch (77919fa) is not applied in this repository.

## Run from source

```bash
npm ci
npm run dev        # local dev server
npm run build      # tsc + logic/lanes/look checks + vite build
node tests/career-lessons.check.mjs
```

Sign-in, cloud save and APIs need the project's Privy/Supabase environment, which is not included. Without it the game runs as a guest.

## How to play

- WASD or arrow keys walk. Shift runs. On a phone, use the stick.
- Drag to look. The wheel zooms. Tap or click the ground to walk there.
- Stand on a doorstep and press **E** to enter. Esc closes a sheet. Enter opens chat.

## Other contracts

`contracts/` holds earlier Solidity (Base) top-up contracts with an internal review in `contracts/AUDIT.md` (`cd contracts && forge test`). They are not part of the NEAR entry. Their deployment status is not re-verified in this README.

## Licences

- NEAR contract (`near/skill-passport/`): MIT.
- Third-party art and models: see `CREDITS.md` (CC0 and similar).
- Other game art and music: not covered by the MIT licence.

## Stack

Vite, TypeScript, Three.js, Privy, Supabase, Vercel, Rust (NEAR), Foundry (Solidity).
