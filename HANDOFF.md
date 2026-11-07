# Reconcile checkpoint: live-world baseline

This branch is a mechanical checkpoint of the richer live-world source; there is no new feature work in it.

- Source commit: `0d356c76f0e5b300abc8b4fe2290efb664e9021f` from a local repo that had no remote (its working tree was left untouched).
- Its 259 non-generated tracked files match, by hash, the source of live Vercel deployment `dpl_7bq3fjVjbK2QJqnNC3FkvnYXdmCr` (grinddistrict.vercel.app, a manual CLI upload with no Git commit).
- `faces-dev.html` also matches live, but it is left out because the repo's `.gitignore` ignores it on purpose.
- This history is unrelated to `Main` (`d78ae2b`) and `fix/gdd-six-preview` (`e493ae3`). No histories were rewritten.
- Not ported yet: the fixes from fix/gdd-six-preview (tour, audio controls, start screen, chat fix). Financial, auth, stats and persistence changes are on hold.
- Do NOT promote to production or change aliases or env from this branch.
- Baseline: `npm ci && npm run build` (tsc, logic and lanes checks, vite build) passes.

## Checkpoint 2: look pass (graphics only)
- Claude's look-pass patch was audited independently in a separate worktree, then applied as is.
- Changes: warm hemisphere bounce colours replace the moss-green bounce (`?look=base` brings back the old colours). Furniture metal is now dark bronze. Furniture has small added details (footboard, sheet edge, chair stretchers, table aprons, nightstand drawer front, a third book row and a shelf plant, fuller plants, and the dresser changes). Adds `src/lookPalette.ts` and the `src/look.check.ts` checks.
- Unchanged, and asserted by the checks: colliders, seats, TV screens, per-piece and outer bounds, and draw calls. Triangles grow at most 8%.
- `world.setQuality()` (the light budget) is defined but NOT called yet, so it has no effect until main.ts wires it to the graphics tier.
- No changes to auth, wallet, saves or stats.
- Not verified yet: how it looks in a browser, and performance on phones.
