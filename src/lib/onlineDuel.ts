import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CategoryId, PaceMode } from '../types'
import { coercePace } from './game'
import { isCategoryId } from './topics'
import { presenceProfile } from './account'
import { safeMediaUrl } from './safeUrl'
import { ensureAnonSession, getSupabase, isSupabaseConfigured, missingSupabaseMessage } from './supabase'

export type DuelBody =
  | { t: 'hello'; name: string; avatar?: string; photo?: string; frame?: string; uid?: string }
  | { t: 'need' }
  | { t: 'here' }
  | { t: 'start'; i: number; at: number }
  | { t: 'pick'; i: number; c: number; s: number; score?: number; correct?: number; streak?: number }
  | { t: 'reveal'; i: number }
  | { t: 'go'; i: number; at: number }
  | { t: 'lobby'; round: number }
  | { t: 'setup'; categoryId: CategoryId; pace: PaceMode }
  | { t: 'begin'; round: number; at: number; categoryId: CategoryId; pace: PaceMode }

export type DuelMsg = DuelBody & { from: string }

type Listener = (msg: DuelMsg) => void

export type DuelSession = {
  code: string
  friendName: string
  friendAvatar?: string
  friendPhoto?: string
  friendFrame?: string
  friendId?: string
  lastClock: Extract<DuelMsg, { t: 'start' | 'go' }> | null
  lastBegin: Extract<DuelMsg, { t: 'begin' }> | null
  ready: Promise<void>
  send: (msg: DuelBody) => void
  subscribe: (listener: Listener) => () => void
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  onPresence: (() => void) | null
}

const listeners = new Set<Listener>()
let inbox: DuelMsg[] = []
let session: DuelSession | null = null
let channel: RealtimeChannel | null = null
let selfKey = ''
let connected = false
let outbound: DuelMsg[] = []

let lockedPeer = ''

function isDuelMsg(value: unknown): value is DuelMsg {
  if (!value || typeof value !== 'object' || !('t' in value) || !('from' in value)) return false
  const msg = value as DuelMsg
  if (typeof msg.from !== 'string' || !msg.from || msg.from.length > 80) return false
  if (msg.t === 'setup') {
    if (!isCategoryId(msg.categoryId)) return false
    msg.pace = coercePace(msg.pace)
    return true
  }
  if (msg.t === 'begin') {
    if (!isCategoryId(msg.categoryId) || typeof msg.round !== 'number' || typeof msg.at !== 'number') return false
    msg.pace = coercePace(msg.pace)
    return true
  }
  if (msg.t === 'lobby') return true
  const t = msg.t
  return t === 'hello' || t === 'need' || t === 'here' || t === 'start' || t === 'pick' || t === 'reveal' || t === 'go'
}

function emit(msg: DuelMsg) {
  if (msg.from === selfKey) return
  if (!isDuelPeer(msg.from) && msg.t !== 'hello') return
  if (msg.t === 'hello') {
    rememberDuelPeer(msg.from)
    if (session) {
      session.friendName = msg.name || 'Friend'
      session.friendAvatar = msg.avatar
      session.friendPhoto = safeMediaUrl(msg.photo)
      session.friendFrame = typeof msg.frame === 'string' ? msg.frame : undefined
      if (msg.uid) session.friendId = msg.uid
    }
  }
  if (msg.t === 'lobby' && session) {
    session.lastClock = null
    session.lastBegin = null
  }
  if (msg.t === 'begin' && session) {
    session.lastBegin = msg
    session.lastClock = null
  }
  if ((msg.t === 'start' || msg.t === 'go') && session) session.lastClock = msg
  if (listeners.size === 0) inbox.push(msg)
  listeners.forEach((listener) => listener(msg))
}

function presenceOthers() {
  if (!channel) return []
  return Object.keys(channel.presenceState()).filter((key) => key !== selfKey)
}

export function rememberDuelPeer(id: string) {
  if (!lockedPeer && id && id !== selfKey) lockedPeer = id
}

export function isDuelPeer(from: string) {
  if (!from || from === selfKey) return false
  if (!lockedPeer) return false
  return from === lockedPeer
}

function flushSend() {
  if (!channel || !connected) return
  while (outbound.length) {
    const msg = outbound.shift()
    if (msg) void channel.send({ type: 'broadcast', event: 'm', payload: msg })
  }
}

function playerKey() {
  const stored = sessionStorage.getItem('quizline-pid')
  if (stored) return stored
  const next = crypto.randomUUID()
  sessionStorage.setItem('quizline-pid', next)
  return next
}

async function connect(code: string) {
  if (!isSupabaseConfigured()) throw new Error(missingSupabaseMessage())
  await ensureAnonSession()
  const supabase = getSupabase()
  if (!supabase) throw new Error(missingSupabaseMessage())

  selfKey = playerKey()
  const next = supabase.channel(`quizline-duel-${code}`, {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: selfKey },
    },
  })

  next
    .on('broadcast', { event: 'm' }, ({ payload }) => {
      if (isDuelMsg(payload)) emit(payload)
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      if (key !== selfKey) {
        rememberDuelPeer(key)
        session?.onPeerJoin?.(key)
      }
      session?.onPresence?.()
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== selfKey) session?.onPeerLeave?.(key)
      session?.onPresence?.()
    })
    .on('presence', { event: 'sync' }, () => {
      session?.onPresence?.()
    })

  const statusWait = new Promise<void>((resolve, reject) => {
    next.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error('Could not join the live room. Check Realtime is enabled on the Supabase project.'))
      }
    })
  })
  await statusWait
  channel = next
  connected = true
  await next.track(presenceProfile())
  flushSend()
}

export function openDuelRoom(code: string): DuelSession {
  if (session?.code === code) return session
  void closeDuelRoom()

  const current: DuelSession = {
    code,
    friendName: 'Friend',
    friendAvatar: undefined,
    friendPhoto: undefined,
    friendFrame: undefined,
    lastClock: null,
    lastBegin: null,
    ready: connect(code),
    send: (msg) => {
      const stamped: DuelMsg = { ...msg, from: selfKey || playerKey() }
      if (stamped.t === 'start' || stamped.t === 'go') current.lastClock = stamped
      if (stamped.t === 'begin') {
        current.lastBegin = stamped
        current.lastClock = null
      }
      if (stamped.t === 'lobby') {
        current.lastBegin = null
        current.lastClock = null
      }
      if (!connected || !channel) outbound.push(stamped)
      else void channel.send({ type: 'broadcast', event: 'm', payload: stamped })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (current.lastBegin) listener(current.lastBegin)
      else if (current.lastClock) listener(current.lastClock)
      if (inbox.length) {
        const queued = inbox
        inbox = []
        queued.forEach(listener)
      }
      return () => {
        listeners.delete(listener)
      }
    },
    onPeerJoin: null,
    onPeerLeave: null,
    onPresence: null,
  }
  session = current
  return current
}

export function getDuelRoom(): DuelSession | null {
  return session
}

export function closeDuelRoom() {
  const current = channel
  channel = null
  connected = false
  outbound.length = 0
  inbox = []
  listeners.clear()
  session = null
  lockedPeer = ''
  if (current) void current.unsubscribe()
}

export function clearDuelHand() {
  inbox = []
  if (!session) return
  session.lastClock = null
  session.lastBegin = null
}

export function peerCount() {
  return presenceOthers().length
}

export function trackDuelProfile() {
  if (!channel) return
  void channel.track(presenceProfile())
}

export function announceHello() {
  session?.send({ t: 'hello', ...presenceProfile() })
}
