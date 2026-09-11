import type { CategoryId, PaceMode } from '../types'
import { formatInvite, makeInviteToken } from './invite'
import { presenceProfile } from './account'
import { coercePace, isPaceMode } from './game'
import { openDuelRoom } from './onlineDuel'
import { isCategoryId } from './topics'
import { ensureAnonSession, getSupabase, isSupabaseConfigured, missingSupabaseMessage } from './supabase'

export type RankedPeer = {
  userId: string
  name: string
  avatar?: string
  photo?: string
  frame?: string
}

type PairMsg = {
  t: 'pair'
  hostId: string
  guestId: string
  code: string
  categoryId: CategoryId
  pace: PaceMode
  host: RankedPeer
  guest: RankedPeer
}

type AckMsg = {
  t: 'ack'
  hostId: string
  guestId: string
  code: string
}

export type RankedMatch = {
  code: string
  role: 'host' | 'guest'
  peer: RankedPeer
  categoryId: CategoryId
  pace: PaceMode
}

const POOL = 'quizline-ranked'

function isPair(value: unknown): value is PairMsg {
  if (!value || typeof value !== 'object') return false
  const msg = value as PairMsg
  return (
    msg.t === 'pair' &&
    typeof msg.hostId === 'string' &&
    typeof msg.guestId === 'string' &&
    typeof msg.code === 'string' &&
    isCategoryId(msg.categoryId) &&
    isPaceMode(msg.pace) &&
    typeof msg.host?.userId === 'string' &&
    typeof msg.guest?.userId === 'string'
  )
}

function isAck(value: unknown): value is AckMsg {
  if (!value || typeof value !== 'object') return false
  const msg = value as AckMsg
  return msg.t === 'ack' && typeof msg.hostId === 'string' && typeof msg.guestId === 'string' && typeof msg.code === 'string'
}

type PresenceRow = {
  userId?: string
  name?: string
  avatar?: string
  photo?: string
  frame?: string
  categoryId?: string
  pace?: string
  at?: number
}

function selfPeer(userId: string, categoryId: CategoryId, pace: PaceMode): RankedPeer & PresenceRow {
  const look = presenceProfile()
  return {
    userId,
    name: look.name,
    avatar: typeof look.avatar === 'string' ? look.avatar : undefined,
    photo: typeof look.photo === 'string' ? look.photo : undefined,
    frame: typeof look.frame === 'string' ? look.frame : undefined,
    categoryId,
    pace,
    at: Date.now(),
  }
}

function asPeer(id: string, row?: PresenceRow): RankedPeer {
  return {
    userId: row?.userId || id,
    name: row?.name || 'Opponent',
    avatar: typeof row?.avatar === 'string' ? row.avatar : undefined,
    photo: typeof row?.photo === 'string' ? row.photo : undefined,
    frame: typeof row?.frame === 'string' ? row.frame : undefined,
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
  const self = selfPeer(selfId, categoryId, pace)
  const channel = supabase.channel(POOL, {
    config: {
      broadcast: { ack: true, self: false },
      presence: { key: selfId },
    },
  })

  return new Promise<RankedMatch>((resolve, reject) => {
    let done = false
    let lastPair: PairMsg | null = null
    let offerTimer = 0
    let retryTimer = 0
    let leaveTimer = 0

    function dropChannel() {
      window.clearInterval(offerTimer)
      window.clearInterval(retryTimer)
      window.clearTimeout(leaveTimer)
      void channel.unsubscribe()
    }

    function finish(error?: Error, match?: RankedMatch) {
      if (done) return
      done = true
      signal?.removeEventListener('abort', onAbort)
      window.clearInterval(offerTimer)
      if (error) {
        dropChannel()
        reject(error)
        return
      }
      if (match) {
        openDuelRoom(match.code)
        leaveTimer = window.setTimeout(dropChannel, 1800)
        resolve(match)
      }
    }

    function onAbort() {
      finish(new Error('Cancelled'))
    }

    function presenceMap() {
      return channel.presenceState() as Record<string, PresenceRow[]>
    }

    function otherIds(extra?: string) {
      const ids = new Set(
        Object.keys(presenceMap()).filter((key) => key && key !== selfId),
      )
      if (extra && extra !== selfId) ids.add(extra)
      return [...ids]
    }

    function pickPartner(extra?: string) {
      const state = presenceMap()
      const scored = otherIds(extra).map((id) => {
        const row = state[id]?.[0]
        const sameCat = row?.categoryId === categoryId
        const samePace = row?.pace === pace
        const score = sameCat && samePace ? 2 : samePace ? 1 : 0
        return { id, score, at: row?.at ?? 0 }
      })
      if (!scored.length) return null
      scored.sort((a, b) => b.score - a.score || a.at - b.at || a.id.localeCompare(b.id))
      return scored[0].id
    }

    function sendPair(pair: PairMsg) {
      void channel.send({ type: 'broadcast', event: 'pair', payload: pair })
    }

    function sendAck(pair: PairMsg) {
      void channel.send({
        type: 'broadcast',
        event: 'ack',
        payload: { t: 'ack', hostId: pair.hostId, guestId: pair.guestId, code: pair.code } satisfies AckMsg,
      })
    }

    function tryOffer(extra?: string) {
      if (done || lastPair) return
      const partnerId = pickPartner(extra)
      if (!partnerId) return
      if (selfId > partnerId) return
      const state = presenceMap()
      const pair: PairMsg = {
        t: 'pair',
        hostId: selfId,
        guestId: partnerId,
        code: formatInvite(categoryId, makeInviteToken(), pace),
        categoryId,
        pace,
        host: self,
        guest: asPeer(partnerId, state[partnerId]?.[0]),
      }
      lastPair = pair
      sendPair(pair)
      window.clearInterval(retryTimer)
      retryTimer = window.setInterval(() => {
        if (done || !lastPair) {
          window.clearInterval(retryTimer)
          return
        }
        sendPair(lastPair)
      }, 600)
    }

    signal?.addEventListener('abort', onAbort)

    channel
      .on('broadcast', { event: 'pair' }, ({ payload }) => {
        if (!isPair(payload)) return
        if (payload.guestId !== selfId && payload.hostId !== selfId) return
        if (payload.hostId === selfId) {
          lastPair = payload
          return
        }
        lastPair = payload
        sendAck(payload)
        window.clearInterval(retryTimer)
        retryTimer = window.setInterval(() => {
          if (done) {
            window.clearInterval(retryTimer)
            return
          }
          sendAck(payload)
        }, 500)
        finish(undefined, {
          code: payload.code,
          role: 'guest',
          peer: { ...payload.host, userId: payload.hostId },
          categoryId: payload.categoryId,
          pace: coercePace(payload.pace),
        })
      })
      .on('broadcast', { event: 'ack' }, ({ payload }) => {
        if (!isAck(payload) || payload.hostId !== selfId) return
        if (!lastPair || lastPair.code !== payload.code) return
        finish(undefined, {
          code: lastPair.code,
          role: 'host',
          peer: { ...lastPair.guest, userId: lastPair.guestId },
          categoryId: lastPair.categoryId,
          pace: lastPair.pace,
        })
      })
      .on('presence', { event: 'sync' }, () => {
        tryOffer()
      })
      .on('presence', { event: 'join' }, ({ key }: { key?: string }) => {
        if (lastPair && key && key !== selfId) sendPair(lastPair)
        else tryOffer(typeof key === 'string' ? key : undefined)
      })

    void channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(self)
        tryOffer()
        window.clearInterval(offerTimer)
        offerTimer = window.setInterval(() => tryOffer(), 800)
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        finish(new Error('Could not join matchmaking. Check Realtime is enabled on the Supabase project.'))
      }
    })

    window.setTimeout(() => {
      if (!done) finish(new Error('No one joined yet. Try again in a moment.'))
    }, 90000)
  })
}
