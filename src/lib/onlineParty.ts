import type { RealtimeChannel } from '@supabase/supabase-js'
import { presenceProfile } from './account'
import { QUESTIONS_PER_MATCH } from './game'
import { safeMediaUrl } from './safeUrl'
import { ensureAnonSession, getSupabase, isSupabaseConfigured, missingSupabaseMessage } from './supabase'
import type { CategoryId, PaceMode, PartyPlayer } from '../types'

export type PartyBody =
  | { t: 'hello'; id: string; name: string; avatar?: string; photo?: string }
  | { t: 'setup'; categoryId: CategoryId; pace: PaceMode }
  | { t: 'begin'; round: number; at: number; i: number; players: PartyPlayer[]; categoryId?: CategoryId; pace?: PaceMode }
  | { t: 'pick'; i: number; c: number; s: number; id: string }
  | { t: 'reveal'; i: number }
  | { t: 'go'; i: number; at: number }
  | { t: 'lobby'; round: number }

export type PartyMsg = PartyBody & { from: string }

type Listener = (msg: PartyMsg) => void

export type PartySession = {
  code: string
  selfId: string
  lastBegin: Extract<PartyMsg, { t: 'begin' }> | null
  lastSetup: Extract<PartyMsg, { t: 'setup' }> | null
  ready: Promise<void>
  send: (msg: PartyBody) => void
  subscribe: (listener: Listener) => () => void
  onPresence: (() => void) | null
}

const listeners = new Set<Listener>()
let inbox: PartyMsg[] = []
let session: PartySession | null = null
let channel: RealtimeChannel | null = null
let selfKey = ''
let selfIsHost = false
let connected = false
let outbound: PartyMsg[] = []
let lockedHost = ''

function isPartyMsg(value: unknown): value is PartyMsg {
  if (!value || typeof value !== 'object' || !('t' in value) || !('from' in value)) return false
  const msg = value as PartyMsg
  if (typeof msg.from !== 'string' || !msg.from || msg.from.length > 80) return false
  if (msg.t === 'setup') return isCategoryId(msg.categoryId) && isPace(msg.pace)
  if (msg.t === 'begin') {
    const categoryOk = msg.categoryId == null || isCategoryId(msg.categoryId)
    const paceOk = msg.pace == null || isPace(msg.pace)
    return categoryOk && paceOk && typeof msg.round === 'number' && typeof msg.at === 'number'
  }
  if (msg.t === 'pick') return typeof msg.id === 'string' && msg.id === msg.from
  const t = msg.t
  return t === 'hello' || t === 'reveal' || t === 'go' || t === 'lobby'
}

function emit(msg: PartyMsg) {
  if (msg.from === selfKey) return
  if (msg.t === 'hello' && msg.id !== msg.from) return
  if (session) {
    if (msg.t === 'begin') session.lastBegin = msg
    if (msg.t === 'setup') session.lastSetup = msg
    if (msg.t === 'lobby') session.lastBegin = null
  }
  if (listeners.size === 0) inbox.push(msg)
  listeners.forEach((listener) => listener(msg))
}

function isCategoryId(value: unknown): value is CategoryId {
  return value === 'mix' || value === 'general' || value === 'science' || value === 'history' || value === 'pop'
}

function isPace(value: unknown): value is PaceMode {
  return value === 'blitz' || value === 'rapid' || value === 'normal'
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

async function connect(code: string, host: boolean) {
  if (!isSupabaseConfigured()) throw new Error(missingSupabaseMessage())
  await ensureAnonSession()
  const supabase = getSupabase()
  if (!supabase) throw new Error(missingSupabaseMessage())

  selfKey = playerKey()
  selfIsHost = host
  const next = supabase.channel(`quizline-party-${code}`, {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: selfKey },
    },
  })

  next
    .on('broadcast', { event: 'm' }, ({ payload }) => {
      if (isPartyMsg(payload)) emit(payload)
    })
    .on('presence', { event: 'sync' }, () => {
      session?.onPresence?.()
    })

  const statusWait = new Promise<void>((resolve, reject) => {
    next.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error('Could not join the party room. Check Realtime is enabled on the Supabase project.'))
      }
    })
  })
  await statusWait
  channel = next
  connected = true
  await next.track(presenceProfile({ host }))
  flushSend()
}

export function openPartyRoom(code: string, host: boolean): PartySession {
  if (session?.code === code) return session
  void closePartyRoom()

  const current: PartySession = {
    code,
    selfId: playerKey(),
    lastBegin: null,
    lastSetup: null,
    ready: connect(code, host),
    send: (msg) => {
      const stamped: PartyMsg = { ...msg, from: selfKey || playerKey() }
      if (stamped.t === 'begin') current.lastBegin = stamped
      if (stamped.t === 'setup') current.lastSetup = stamped
      if (stamped.t === 'lobby') current.lastBegin = null
      if (stamped.t === 'go' && stamped.i >= QUESTIONS_PER_MATCH) current.lastBegin = null
      if (!connected || !channel) outbound.push(stamped)
      else void channel.send({ type: 'broadcast', event: 'm', payload: stamped })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (current.lastSetup) listener(current.lastSetup)
      if (current.lastBegin && Date.now() < current.lastBegin.at + 4000) listener(current.lastBegin)
      if (inbox.length) {
        const queued = inbox
        inbox = []
        queued.forEach(listener)
      }
      return () => {
        listeners.delete(listener)
      }
    },
    onPresence: null,
  }
  session = current
  if (host) lockedHost = current.selfId
  return current
}

export function clearPartyBegin() {
  if (session) session.lastBegin = null
}

export function getPartyRoom(): PartySession | null {
  return session
}

export function partySelfId() {
  return session?.selfId ?? playerKey()
}

export function listPartyPlayers(): PartyPlayer[] {
  const self = session ? [{ id: session.selfId, host: selfIsHost, ...presenceProfile() }] : []
  if (!channel) return self
  const state = channel.presenceState() as Record<string, { name?: string; host?: boolean; avatar?: string; photo?: string }[]>
  const listed = Object.entries(state).map(([id, metas]) => ({
    id,
    name: metas[0]?.name?.trim() || 'Friend',
    host: Boolean(metas[0]?.host),
    avatar: metas[0]?.avatar,
    photo: safeMediaUrl(metas[0]?.photo),
  }))
  const selfId = session?.selfId
  if (selfId && !listed.some((player) => player.id === selfId)) {
    return [...self, ...listed]
  }
  return listed
}

export function isPartyHostSender(from: string) {
  if (!from || from === selfKey) return false
  if (selfIsHost) return false
  if (!lockedHost) {
    const host = listPartyPlayers().find((player) => player.host && player.id !== selfKey)
    if (host) lockedHost = host.id
  }
  return Boolean(lockedHost) && from === lockedHost
}

export function isPartySeat(from: string) {
  return listPartyPlayers().some((player) => player.id === from)
}

export async function trackPartyProfile(host: boolean) {
  if (!channel) return
  selfIsHost = host
  await channel.track(presenceProfile({ host }))
}

export function closePartyRoom() {
  const current = channel
  channel = null
  connected = false
  outbound.length = 0
  inbox = []
  listeners.clear()
  session = null
  selfIsHost = false
  lockedHost = ''
  if (current) void current.unsubscribe()
}

export function announcePartyHello() {
  const id = session?.selfId ?? playerKey()
  session?.send({ t: 'hello', id, ...presenceProfile() })
}
