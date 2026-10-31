# Grind District

A browser life sim inside Web3. You start as a shrimp and walk one shared 3D city with other players. Rank moves by courses, reps, and consistency. Balance does not move it.

**No tribe. No continent. Just come grind.**

Live: https://grinddistrict.vercel.app

Made by [Zahra](https://0xzahra.github.io).

## What's in the city

- **Shared 3D city.** Walk the streets with other players in real time, chat with people nearby, and see their names and ranks.
- **Sign in with Google** through Privy. Your progress follows your account.
- **20 courses with certificates.** Pass a course in the learning hall and earn a certificate that is added to your profile.
- **Practice trading by category.** Trade practice books by market category on the trading floor and in the trenches. Practice funds are not real money and nothing here is financial advice.
- **Vehicles.** Get around the city faster.
- **Conference centre.** Talks and events in the city.
- **Profiles with share cards.** Each player has a public profile and share card at `https://grinddistrict.vercel.app/cv/<username>`.
- Gym, church, prayer space, cafés, boutique, houses, gadgets, and the plaza.

## Top-ups (Base)

Players can top up in **ETH or USDC on Base**. Funds go to **GrindTreasury** at `0x6bc81e26832986d56b6e59c31599f3113971ec33`, and **98%** of the top-up is credited in-game through **GrindLedger** at `0x88091d65d38a4e153267f43744fb48e10e456d30`. Both contracts are owned by a Safe multisig. See `contracts/AUDIT.md` for the internal review.

## Run

```bash
npm install
npm run dev
npm run build
```

## How to play

- WASD or arrow keys walk. Shift runs. On a phone, use the stick.
- Drag to look. The wheel zooms. Click the ground to walk there.
- Stand on a doorstep and press **E** to enter. Esc closes a sheet.
- Enter opens chat.

## Contracts

```bash
cd contracts
forge test
```

## Stack

Vite, TypeScript, Three.js, Privy, Supabase, Vercel, and Foundry (Solidity on Base).
