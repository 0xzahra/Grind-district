# Reproducible dependency installation

Run `npm ci`, then `npm run build`.

The upstream package-lock.json contained a literal file-reference placeholder, not JSON. It was regenerated from the current GitHub declarations. Source imports Supabase but omitted its package declaration; @supabase/supabase-js was restored.

Privy node 0.37 requires optional @solana/kit ^5.1.0. Privy React accepts kit >=3.0.3, but its unconstrained system-program peer selected 0.16, which imports @solana/kit/program-client-core. Kit 5 has no such subpath (introduced in Kit 6.1). Pin Kit 5.5.1, system program 0.10.0 and token program 0.9.0: the latter two declare Kit ^5.0 peers. This retains existing authentication and wallet implementations; no functionality is stubbed and no blanket dependency overrides are used.

The repository already declares TypeScript ~7.0.2, while Kit 5 declares optional TypeScript ^5.0.0. .npmrc therefore records legacy-peer-deps=true so npm ci reproduces the regenerated lock without silently downgrading TypeScript or upgrading Privy. This skips peer enforcement; it is not a claim all optional upstream combinations are supported. Runtime authentication and wallet integration still require browser testing.

No audit/security-clean claim is made. Install reported upstream deprecations.

Privy also pulls @stripe/crypto, whose peer @stripe/stripe-js ^1.46.0 must be installed explicitly with legacy peer mode. Added that compatible peer rather than externalizing/stubbing its imports.

## Welcome DOM regression environment
Pinned dev-only jsdom31.0.0 provides a real DOM/event/CSS unit environment without running a browser. Supports Node ^22.22.2 / ^24.15.0 / >=26; current box Node24.22.1. Thirty new development dependency entries; no existing lockfile resolved versions changed. Tests explicitly do not claim geometry, GPU layout, trusted pointer events or browser hit testing. Existing npm ci configuration remains unchanged.
