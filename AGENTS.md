# Grind District: notes for AI coding assistants

Read this before changing anything. The owner builds the game by describing changes ("vibecoding") and does not
read code, so the steps below must happen without being asked.

## What this is

A free 3D Web3-learning city game: Vite + TypeScript + three.js in `src/`, Vercel serverless functions in `api/`,
Supabase for data. Live at https://www.grinddistrict.app.

## Shipping

- Work on `main`. Before pushing, run `npx tsc --noEmit -p .`, `npm run check` and `npx vite build`; all must pass.
- Push with `git pull --rebase origin main && git push origin HEAD:main`. Vercel deploys every push to main.
- Players move to the new version by themselves (`src/freshness.ts`): open games are offered a refresh, and
  the title screen reloads into it. Nothing else to do.

## Every player-facing change: add a release note (do not skip this)

Add an entry at the END of `public/updates.json`:

```json
{ "id": "u1120-short-name", "title": "New: something players will notice", "body": "One or two plain sentences: what it is and where to find it.", "go": "panel:boutique" }
```

- `id` must be new and unique (date + short name). Never edit or reuse old ids: players have seen them.
- Write for players, not developers. No code words, no file names.
- `go` (optional) is where tapping the note leads: `panel:<id>` (trade, boutique, profile, seasons, diploma,
  homes...), `place:<name>`, `gallery`, `players`, `messages`, `balance`.
- That one entry shows in every player's notifications, and the newest entry is sent as a phone alert to
  players who turned phone alerts on (at most one alert a day, `api/_notify.ts`). For small fixes nobody needs
  to be alerted about, add `"push": false`.

## The owner's rules (keep them)

- Do not touch top-up, payments (the 5 USDC top-up), accounts, login or save code. Do not change the save format.
- Graphics settings stay Low, Medium and High only.
- Do not put the Balance pill back on the HUD; no balance reveal. The Online pill sits beside the Gallery key.
- No XP or points shown anywhere: rewards show and give reputation only.
- Do not replace the existing free clothes. No prediction markets.
- The DeFi desk and Perps use earned in-game cash only, never top-ups.
- Commits pushed by other bots (for example grok) are the owner's: leave them alone.
- Never ask for or accept seed phrases or private keys.
- Original designs only: do not copy another game's name, characters, art, music or levels.
- No AI model names or ids in code, commits or pull requests.

## Keep it fast on phones

- Heavy pixel work runs off the main thread (`src/dressWorker.ts`, `src/skinPaint.ts`); keep it there.
- Phones are paced (`main.ts`, frame pacing): 30 frames a second where a phone needs it, 20 when idle.
- Anything new that draws should batch (`src/batch.ts`) and avoid adding draw calls per frame.
- After a GPU context loss the game rebuilds what lived on the GPU (`webglcontextrestored` in `main.ts`):
  anything new that renders into a render target once must be redrawn there too.
