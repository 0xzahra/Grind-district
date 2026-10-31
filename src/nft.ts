// NFT collections (collection masks: CryptoPunks, Bored Apes, Pudgy, Azuki, Nodemonkes, DeGods; collection skin slots).
// DISABLED. The code stays in masks.ts / skins.ts / faces.ts so it can be re-added piece by piece.
// While false: the boutique shows no collection items, saved masks are migrated to 'none',
// and every player gets the rigged Quaternius model (a mask used to force the old procedural box body).
export const NFT_COLLECTIONS_ENABLED = false

// Extra bodies (Shrimp mascot, Ledger, Marina, Signal). DISABLED: the boutique offers only Man and Woman.
// Their procedural code stays in avatars.ts/shrimp.ts. Saved players on one of them are migrated to Man.
export const EXTRA_BODIES_ENABLED = false
