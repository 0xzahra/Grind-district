import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PrivyClient } from '@privy-io/node'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyPrivySession } from './verify-session.ts'
import { claimVerifiedTransfers, type TopupClaim, type TopupClaimStore } from './topup-credit.ts'
import { TopupVerificationError, verifyBaseTransfers, type RpcCall } from './topup-verifier.ts'

const BASE_RPC_DEFAULT = 'https://mainnet.base.org'
const MAX_BODY_BYTES = 2048

type TopupDatabase = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: {
      claim_verified_topup: {
        Args: {
          p_chain_id: number
          p_tx_hash: string
          p_log_index: string
          p_privy_user_id: string
          p_wallet_address: string
          p_amount_micros: string
          p_block_number: string
        }
        Returns: { claimed: boolean; balance_micros: string }[]
      }
      verified_topup_balance: {
        Args: { p_privy_user_id: string }
        Returns: string
      }
    }
  }
}

type BodyRequest = IncomingMessage & { body?: unknown }
type PrivyWalletRecord = { type?: unknown; chain_type?: unknown; address?: unknown }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
}

function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  return value?.replace(/^Bearer\s+/i, '').trim() ?? ''
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function createStore(): TopupClaimStore | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  let client: SupabaseClient<TopupDatabase>
  try {
    client = createClient<TopupDatabase>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  } catch {
    return null
  }
  return {
    async claim(claim: TopupClaim): Promise<boolean> {
      const { data, error } = await client.rpc('claim_verified_topup', {
        p_chain_id: claim.chainId,
        p_tx_hash: claim.txHash,
        p_log_index: claim.logIndex,
        p_privy_user_id: claim.privyUserId,
        p_wallet_address: claim.walletAddress,
        p_amount_micros: claim.amountMicros,
        p_block_number: claim.blockNumber,
      })
      if (error) throw new Error('The verified top-up could not be saved.')
      const row = Array.isArray(data) ? asRecord(data[0]) : asRecord(data)
      return row?.claimed === true
    },
    async balance(privyUserId: string): Promise<string> {
      const { data, error } = await client.rpc('verified_topup_balance', { p_privy_user_id: privyUserId })
      if (error || typeof data !== 'string' || !/^\d+$/.test(data)) throw new Error('The verified top-up balance could not be loaded.')
      return data
    },
  }
}

function createBaseRpc(): RpcCall {
  const endpoint = (process.env.BASE_RPC_URL || BASE_RPC_DEFAULT).trim()
  return async (method, params) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error('Base RPC request failed.')
    const payload = asRecord(await response.json())
    if (!payload || payload.error || !('result' in payload)) throw new Error('Base RPC returned an invalid response.')
    return payload.result
  }
}

function privyClient(): PrivyClient | null {
  const appId = (process.env.PRIVY_APP_ID || process.env.VITE_PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  return appId && appSecret ? new PrivyClient({ appId, appSecret }) : null
}

async function authenticatedUser(req: IncomingMessage, res: ServerResponse): Promise<{ id: string } | null> {
  const session = await verifyPrivySession(bearer(req.headers.authorization))
  if ('id' in session) return session
  send(res, session.error.includes('no Privy') ? 503 : 401, { error: session.error })
  return null
}

async function linkedEthereumWallets(privyUserId: string): Promise<string[]> {
  const client = privyClient()
  if (!client) throw new TopupVerificationError('Privy is not configured on this server.', 503)
  const user = await client.users()._get(privyUserId)
  const accounts = (user as { linked_accounts?: PrivyWalletRecord[] }).linked_accounts ?? []
  return accounts
    .filter((account) => (account.type === 'wallet' || account.type === 'smart_wallet') && account.chain_type === 'ethereum')
    .map((account) => typeof account.address === 'string' ? account.address : '')
    .filter((address) => /^0x[0-9a-f]{40}$/i.test(address))
}

async function requestHash(req: BodyRequest): Promise<string> {
  if (req.body !== undefined) {
    const existing = req.body
    const body = typeof existing === 'string' ? JSON.parse(existing) as unknown : existing
    const hash = asRecord(body)?.hash
    return typeof hash === 'string' ? hash.trim() : ''
  }
  let text = ''
  let size = 0
  for await (const part of req) {
    const chunk = typeof part === 'string' ? part : new TextDecoder().decode(part)
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new TopupVerificationError('The request body is too large.', 413)
    text += chunk
  }
  try {
    const hash = asRecord(JSON.parse(text) as unknown)?.hash
    return typeof hash === 'string' ? hash.trim() : ''
  } catch {
    throw new TopupVerificationError('Send a JSON body with a transaction hash.', 400)
  }
}

export async function handleTopupBalance(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    send(res, 405, { error: 'Use GET.' })
    return
  }
  const user = await authenticatedUser(req, res)
  if (!user) return
  const store = createStore()
  if (!store) {
    send(res, 503, { error: 'Verified top-ups are not configured on this server yet.' })
    return
  }
  try {
    send(res, 200, { balanceMicros: await store.balance(user.id) })
  } catch {
    send(res, 503, { error: 'The verified top-up balance is temporarily unavailable.' })
  }
}

export async function handleTopupVerify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Use POST.' })
    return
  }
  const user = await authenticatedUser(req, res)
  if (!user) return
  const store = createStore()
  if (!store) {
    send(res, 503, { error: 'Verified top-ups are not configured on this server yet.' })
    return
  }
  try {
    const hash = await requestHash(req as BodyRequest)
    const wallets = await linkedEthereumWallets(user.id)
    if (!wallets.length) throw new TopupVerificationError('Link the wallet that sent the deposit to your Privy account first.', 403)
    const transfers = await verifyBaseTransfers(hash, wallets, createBaseRpc())
    const result = await claimVerifiedTransfers(hash, user.id, transfers, store)
    send(res, 200, { ...result, transferCount: transfers.length })
  } catch (error) {
    if (error instanceof TopupVerificationError) {
      send(res, error.status, { error: error.message })
      return
    }
    send(res, 503, { error: 'Top-up verification is temporarily unavailable.' })
  }
}
