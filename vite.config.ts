import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import agentClaim from './api/agents/claim.ts'
import agentFirstEarn from './api/agents/first-earn.ts'
import privySession from './api/privy/session.ts'

function apiRoutes(): Plugin {
  const routes: Record<string, typeof privySession> = {
    '/api/privy/session': privySession,
    '/api/agents/claim': agentClaim,
    '/api/agents/first-earn': agentFirstEarn,
  }
  const attach = (middlewares: Connect.Server) => {
    middlewares.use(async (req, res, next) => {
      const path = (req.url ?? '').split('?')[0]
      const handler = routes[path]
      if (!handler) {
        next()
        return
      }
      void handler(req, res)
    })
  }
  return {
    name: 'grind-district-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.PRIVY_APP_SECRET = env.PRIVY_APP_SECRET
  process.env.PRIVY_APP_ID = env.PRIVY_APP_ID || env.VITE_PRIVY_APP_ID
  process.env.VITE_PRIVY_APP_ID = env.VITE_PRIVY_APP_ID
  return {
    plugins: [apiRoutes()],
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
  }
})
