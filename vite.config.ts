import { defineConfig } from 'vite'

// Every build carries its own version (the deployed commit on Vercel), and ships /release.json saying which
// version is live. Open games compare the two to notice a newer version (src/freshness.ts).
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12) || `local-${Date.now().toString(36)}`

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    {
      name: 'release-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ id: BUILD, at: new Date().toISOString() }) })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: true,
  },
})
