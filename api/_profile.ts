import { createClient } from '@supabase/supabase-js'
export type PublicProfile = { username: string; name: string; rank: string; reputation: number; balance: number; skills: string[] }
/** Public profile snapshot for share cards, or null. */
export async function getProfile(raw: string): Promise<PublicProfile | null> {
  const u = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!u || !url || !key) return null
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await db.from('public_profiles').select('username,name,rank,reputation,balance,skills').eq('username', u).maybeSingle()
  return data ? { ...data, balance: Number(data.balance), skills: data.skills ?? [] } as PublicProfile : null
}
