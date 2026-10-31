import type { SupabaseClient } from '@supabase/supabase-js'

// Each player gets an in-game wallet on sign-up. deposit_tag is a unique 6-digit tag: the player sends
// N.TTTTTT USDC (amount ending in their tag) or puts it as the memo/reference; the poller matches it.
export async function ensureWallet(db: SupabaseClient, userId: string): Promise<{ deposit_tag: string; balance: number } | null> {
  const found = await db.from('wallets').select('deposit_tag,balance').eq('privy_user_id', userId).maybeSingle()
  if (found.data) return found.data as { deposit_tag: string; balance: number }
  for (let i = 0; i < 5; i += 1) {
    const tag = String(100000 + Math.floor(Math.random() * 900000))
    const { data, error } = await db.from('wallets').insert({ privy_user_id: userId, deposit_tag: tag, balance: 0 }).select('deposit_tag,balance').single()
    if (!error) return data as { deposit_tag: string; balance: number }
    if (error.code !== '23505') return null
  }
  return null
}
