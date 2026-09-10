import { parseAvatarId, type AvatarId } from './avatars'
import { getSupabase } from './supabase'
import { safeMediaUrl } from './safeUrl'

export type LeaderboardKind = 'global' | 'national' | 'friends'

export type LeaderboardRow = {
  userId: string
  name: string
  username: string
  avatarId: AvatarId
  photoUrl: string | null
  country: string | null
  wins: number
  points: number
  rank: number
  isYou: boolean
}

type RpcRow = {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_id: string | null
  photo_url: string | null
  country: string | null
  wins: number | null
  points: number | null
  rank: number | null
}

export async function loadLeaderboard(kind: LeaderboardKind, country?: string | null): Promise<LeaderboardRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Add Supabase keys to enable ranks.')
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData.session?.user
  if (!user || user.is_anonymous) throw new Error('Sign in with an account to see ranks.')
  const { data, error } = await supabase.rpc('leaderboard_rows', {
    kind,
    country_code: country || null,
  })
  if (error) {
    if (/leaderboard_rows|ranked_stats|schema cache/i.test(error.message)) {
      throw new Error('Ranks need a one-time database update. Run the new Ranked section in supabase/schema.sql.')
    }
    throw new Error(error.message)
  }
  const rows = (Array.isArray(data) ? data : []) as RpcRow[]
  return rows.map((row) => ({
    userId: row.user_id,
    name: (row.display_name || row.username || 'Player').slice(0, 16),
    username: (row.username || '').toLowerCase(),
    avatarId: parseAvatarId(row.avatar_id),
    photoUrl: safeMediaUrl(row.photo_url) ?? null,
    country: row.country,
    wins: Number(row.wins) || 0,
    points: Number(row.points) || 0,
    rank: Number(row.rank) || 0,
    isYou: row.user_id === user.id,
  }))
}

export async function recordRankedResult(input: {
  code: string
  opponentId: string
  myScore: number
  theirScore: number
  categoryId: string
  pace: string
}) {
  const supabase = getSupabase()
  if (!supabase || !input.opponentId) return
  const { error } = await supabase.rpc('report_ranked_result', {
    p_code: input.code,
    p_opponent: input.opponentId,
    p_my_score: Math.max(0, Math.round(input.myScore)),
    p_their_score: Math.max(0, Math.round(input.theirScore)),
    p_category: input.categoryId,
    p_pace: input.pace,
  })
  if (error) console.warn('Could not save ranked result', error.message)
}
