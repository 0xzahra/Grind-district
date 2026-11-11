// Node loader hook for checks/scripts: lets `node --experimental-strip-types --import ./scripts/ts-hooks.mjs`
// load api/*.ts files that use Vercel-style './x.js' specifiers for sibling .ts files.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && spec.endsWith('.js') && ctx.parentURL) {
    const ts = new URL(spec.slice(0, -3) + '.ts', ctx.parentURL)
    if (existsSync(fileURLToPath(ts))) return next(ts.href, ctx)
  }
  return next(spec, ctx)
}`))
