import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { verifyPrivySession } from './server/verify-session.ts'
import { handleTopupBalance, handleTopupVerify } from './server/topup-api.ts'

function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return ''
  return value.replace(/^Bearer\s+/i, '').trim()
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function handleSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Use POST.' })
    return
  }
  const session = await verifyPrivySession(bearer(req.headers.authorization))
  if ('id' in session) {
    send(res, 200, session)
    return
  }
  send(res, session.error.includes('no Privy') ? 503 : 401, session)
}

function privySession(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use(async (req, res, next) => {
      const path = (req.url ?? '').split('?')[0]
      if (path === '/api/privy/session') {
        await handleSession(req, res)
        return
      }
      if (path === '/api/topup/balance') {
        await handleTopupBalance(req, res)
        return
      }
      if (path === '/api/topup/verify') {
        await handleTopupVerify(req, res)
        return
      }
      next()
    })
  }
  return {
    name: 'privy-session',
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
  if (env.PRIVY_APP_SECRET) process.env.PRIVY_APP_SECRET = env.PRIVY_APP_SECRET
  if (env.PRIVY_APP_ID || env.VITE_PRIVY_APP_ID) process.env.PRIVY_APP_ID = env.PRIVY_APP_ID || env.VITE_PRIVY_APP_ID
  if (env.VITE_PRIVY_APP_ID) process.env.VITE_PRIVY_APP_ID = env.VITE_PRIVY_APP_ID
  if (env.SUPABASE_URL || env.VITE_SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
  if (env.BASE_RPC_URL) process.env.BASE_RPC_URL = env.BASE_RPC_URL
  return {
    plugins: [privySession()],
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
