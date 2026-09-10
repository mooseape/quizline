import { parseAvatarId, type AvatarId } from './avatars'
import { parseFrameId, type FrameId } from './frames'
import { safeMediaUrl } from './safeUrl'
import { getSupabase } from './supabase'

export type FriendProfile = {
  id: string
  name: string
  username: string
  avatarId: AvatarId
  photoUrl: string | null
  frameId: FrameId | null
}

export type FriendEntry = {
  id: string
  profile: FriendProfile
}

export type FriendList = {
  friends: FriendEntry[]
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
}

type ProfileRow = {
  id: string
  display_name: string | null
  username: string | null
  avatar_id: string | null
  photo_url: string | null
  frame_id: string | null
}

type FriendshipRow = {
  id: string
  status: 'pending' | 'accepted'
  requester_id: string
  addressee_id: string
  requester: ProfileRow | ProfileRow[] | null
  addressee: ProfileRow | ProfileRow[] | null
}

const MISSING_TABLE = /friendships|username|schema cache|could not find|lookup_profile|is_email_user|frame_id/i

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function asProfile(row: ProfileRow | null): FriendProfile | null {
  if (!row?.id) return null
  return {
    id: row.id,
    name: (row.display_name || row.username || 'Friend').slice(0, 16),
    username: (row.username || '').toLowerCase(),
    avatarId: parseAvatarId(row.avatar_id),
    photoUrl: safeMediaUrl(row.photo_url) ?? null,
    frameId: parseFrameId(row.frame_id),
  }
}

function schemaError(error: { message: string }) {
  if (MISSING_TABLE.test(error.message)) {
    return new Error('Friends need a one-time database update. Run the Friends and Security sections in supabase/schema.sql.')
  }
  return new Error(error.message)
}

async function requireUserId() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Add Supabase keys to enable friends.')
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.is_anonymous) throw new Error('Sign in with an account to add friends.')
  return { supabase, userId: user.id }
}

export async function loadFriends(): Promise<FriendList> {
  const { supabase, userId } = await requireUserId()
  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, status, requester_id, addressee_id, requester:profiles!requester_id(id, display_name, username, avatar_id, photo_url, frame_id), addressee:profiles!addressee_id(id, display_name, username, avatar_id, photo_url, frame_id)',
    )
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw schemaError(error)

  const friends: FriendEntry[] = []
  const incoming: FriendEntry[] = []
  const outgoing: FriendEntry[] = []

  for (const row of (data ?? []) as FriendshipRow[]) {
    const requester = asProfile(one(row.requester))
    const addressee = asProfile(one(row.addressee))
    const other = row.requester_id === userId ? addressee : requester
    if (!other) continue
    const entry = { id: row.id, profile: other }
    if (row.status === 'accepted') friends.push(entry)
    else if (row.addressee_id === userId) incoming.push(entry)
    else outgoing.push(entry)
  }

  friends.sort((a, b) => a.profile.name.localeCompare(b.profile.name))
  return { friends, incoming, outgoing }
}

export async function sendFriendRequest(rawTag: string) {
  const tag = rawTag.trim().replace(/^@+/, '').toLowerCase()
  if (tag.length < 3) throw new Error('Use their Quizline tag, like moose or player12.')
  const { supabase, userId } = await requireUserId()

  const { data: me } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
  if (me?.username && me.username.toLowerCase() === tag) throw new Error("That's your own tag.")

  const { data: found, error: lookError } = await supabase.rpc('lookup_profile_by_username', { tag })
  if (lookError) throw schemaError(lookError)
  const target = Array.isArray(found) ? found[0] : found
  if (!target?.id) throw new Error('No account uses that tag.')

  const { data: existing, error: existingError } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${userId})`,
    )
    .maybeSingle()
  if (existingError) throw schemaError(existingError)
  if (existing?.status === 'accepted') throw new Error("You're already friends.")
  if (existing && existing.requester_id === userId) throw new Error('Friend request already sent.')
  if (existing && existing.addressee_id === userId) {
    await acceptFriendRequest(existing.id)
    return { accepted: true as const }
  }

  const { error } = await supabase.from('friendships').insert({
    requester_id: userId,
    addressee_id: target.id,
    status: 'pending',
  })
  if (error) throw schemaError(error)
  return { accepted: false as const }
}

export async function acceptFriendRequest(id: string) {
  const { supabase } = await requireUserId()
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
  if (error) throw schemaError(error)
}

export async function removeFriendship(id: string) {
  const { supabase } = await requireUserId()
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  if (error) throw schemaError(error)
}

export function subscribeFriends(userId: string, onChange: () => void) {
  const supabase = getSupabase()
  if (!supabase) return () => undefined
  const incoming = supabase
    .channel(`friends-in-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${userId}` }, onChange)
    .subscribe()
  const outgoing = supabase
    .channel(`friends-out-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${userId}` }, onChange)
    .subscribe()
  return () => {
    void supabase.removeChannel(incoming)
    void supabase.removeChannel(outgoing)
  }
}
