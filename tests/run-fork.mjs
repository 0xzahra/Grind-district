// Bundles tests/topup.fork.test.ts (resolves .js->.ts imports) and runs it against FORK_RPC.
import { build } from 'rolldown'
await build({ input: 'tests/topup.fork.test.ts', platform: 'node', external: [/^viem/], output: { file: 'tests/.out/topup.fork.mjs', format: 'esm' } })
await import('./.out/topup.fork.mjs')
