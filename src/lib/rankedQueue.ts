import type { CategoryId, PaceMode } from '../types'
import { formatInvite, makeInviteToken } from './invite'
import { presenceProfile } from './account'
import { getCurrentUserId } from './sessionUser'
import { ensureAnonSession, getSupabase, isSupabaseConfigured, missingSupabaseMessage } from './supabase'

export type RankedPeer = {
  userId: string
  name: string
  avatar?: string
  photo?: string
}

type PairMsg = {
  t: 'pair'
  hostId: string
  guestId: string
  code: string
  host: RankedPeer
  guest: RankedPeer
}

function isPair(value: unknown): value is PairMsg {
  if (!value || typeof value !== 'object') return false
  const msg = value as PairMsg
  return (
    msg.t === 'pair' &&
    typeof msg.hostId === 'string' &&
    typeof msg.guestId === 'string' &&
    typeof msg.code === 'string' &&
    typeof msg.host?.userId === 'string' &&
    typeof msg.guest?.userId === 'string'
  )
}

export type RankedMatch = {
  code: string
  role: 'host' | 'guest'
  peer: RankedPeer
}

function selfPeer(): RankedPeer {
  const look = presenceProfile()
  return {
    userId: getCurrentUserId(),
    name: look.name,
    avatar: typeof look.avatar === 'string' ? look.avatar : undefined,
    photo: typeof look.photo === 'string' ? look.photo : undefined,
  }
}

export async function findRankedMatch(
  categoryId: CategoryId,
  pace: PaceMode,
  onWaiting?: () => void,
  signal?: AbortSignal,
): Promise<RankedMatch> {
  if (!isSupabaseConfigured()) throw new Error(missingSupabaseMessage())
  const supabase = getSupabase()
  if (!supabase) throw new Error(missingSupabaseMessage())
  await ensureAnonSession()
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.is_anonymous || !user.email) {
    throw new Error('Sign in with an account to play a random opponent.')
  }
  const selfId = user.id

  onWaiting?.()
  const self = { ...selfPeer(), userId: selfId }
  const topic = `quizline-ranked-${categoryId}-${pace}`
  const channel = supabase.channel(topic, {
    config: {
      broadcast: { ack: false, self: true },
      presence: { key: selfId },
    },
  })

  return new Promise<RankedMatch>((resolve, reject) => {
    let done = false
    let offered = false
    let lastPair: PairMsg | null = null

    function finish(error?: Error, match?: RankedMatch) {
      if (done) return
      done = true
      signal?.removeEventListener('abort', onAbort)
      void channel.unsubscribe()
      if (error) reject(error)
      else if (match) resolve(match)
    }

    function onAbort() {
      finish(new Error('Cancelled'))
    }

    function othersWaiting() {
      const state = channel.presenceState() as Record<string, { userId?: string; at?: number }[]>
      return Object.entries(state)
        .filter(([key]) => key !== selfId)
        .map(([key, rows]) => ({
          userId: rows[0]?.userId || key,
          at: rows[0]?.at ?? 0,
        }))
        .sort((a, b) => a.at - b.at || a.userId.localeCompare(b.userId))
    }

    function presenceOf(id: string): RankedPeer {
      const state = channel.presenceState() as Record<string, { userId?: string; name?: string; avatar?: string; photo?: string }[]>
      const row = state[id]?.[0]
      return {
        userId: row?.userId || id,
        name: row?.name || 'Opponent',
        avatar: typeof row?.avatar === 'string' ? row.avatar : undefined,
        photo: typeof row?.photo === 'string' ? row.photo : undefined,
      }
    }

    function tryOffer() {
      if (done || offered) return
      const waiting = othersWaiting()
      if (!waiting.length) return
      const partner = waiting[0]
      if (selfId > partner.userId) return
      offered = true
      const code = formatInvite(categoryId, makeInviteToken(), pace)
      const pair: PairMsg = {
        t: 'pair',
        hostId: selfId,
        guestId: partner.userId,
        code,
        host: self,
        guest: presenceOf(partner.userId),
      }
      lastPair = pair
      void channel.send({ type: 'broadcast', event: 'pair', payload: pair })
    }

    signal?.addEventListener('abort', onAbort)

    channel
      .on('broadcast', { event: 'pair' }, ({ payload }) => {
        if (!isPair(payload)) return
        if (payload.hostId !== selfId && payload.guestId !== selfId) return
        const role = payload.hostId === selfId ? 'host' : 'guest'
        const peer = role === 'host' ? { ...payload.guest, userId: payload.guestId } : payload.host
        finish(undefined, { code: payload.code, role, peer })
      })
      .on('presence', { event: 'sync' }, () => {
        tryOffer()
      })
      .on('presence', { event: 'join' }, () => {
        if (lastPair) void channel.send({ type: 'broadcast', event: 'pair', payload: lastPair })
        else tryOffer()
      })

    void channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ ...self, at: Date.now() })
        tryOffer()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        finish(new Error('Could not join matchmaking. Check Realtime is enabled.'))
      }
    })

    window.setTimeout(() => {
      if (!done) finish(new Error('No one joined yet. Try again in a moment.'))
    }, 90000)
  })
}
