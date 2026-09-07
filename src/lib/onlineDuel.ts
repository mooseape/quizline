import { joinRoom, type Room } from 'trystero'
import { handleOrYou } from './handle'
import { roomTopic } from './invite'

export type DuelMsg =
  | { t: 'hello'; name: string }
  | { t: 'start'; i: number; at: number }
  | { t: 'pick'; i: number; c: number; s: number }
  | { t: 'reveal'; i: number }
  | { t: 'go'; i: number; at: number }

type Listener = (msg: DuelMsg) => void

type Session = {
  code: string
  room: Room
  friendName: string
  lastClock: Extract<DuelMsg, { t: 'start' | 'go' }> | null
  send: (msg: DuelMsg) => void
  subscribe: (listener: Listener) => () => void
}

const APP_ID = 'quizline-1v1'
const listeners = new Set<Listener>()
let inbox: DuelMsg[] = []
let session: Session | null = null

function isDuelMsg(value: unknown): value is DuelMsg {
  if (!value || typeof value !== 'object' || !('t' in value)) return false
  const t = (value as DuelMsg).t
  return t === 'hello' || t === 'start' || t === 'pick' || t === 'reveal' || t === 'go'
}

function emit(msg: DuelMsg) {
  if (msg.t === 'hello' && session) session.friendName = msg.name || 'Friend'
  if ((msg.t === 'start' || msg.t === 'go') && session) session.lastClock = msg
  if (listeners.size === 0) inbox.push(msg)
  listeners.forEach((listener) => listener(msg))
}

export function openDuelRoom(code: string): Session {
  if (session?.code === code) return session
  void closeDuelRoom()

  const room = joinRoom({ appId: APP_ID }, roomTopic(code), {
    onJoinError: (details) => {
      console.warn('Quizline room error', details)
    },
  })
  const action = room.makeAction<DuelMsg>('m')
  action.onMessage = (data) => {
    if (isDuelMsg(data)) emit(data)
  }

  session = {
    code,
    room,
    friendName: 'Friend',
    lastClock: null,
    send: (msg) => {
      if (msg.t === 'start' || msg.t === 'go') session && (session.lastClock = msg)
      void action.send(msg)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (session?.lastClock) listener(session.lastClock)
      if (inbox.length) {
        const queued = inbox
        inbox = []
        queued.forEach(listener)
      }
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return session
}

export function getDuelRoom(): Session | null {
  return session
}

export function closeDuelRoom() {
  const current = session
  session = null
  inbox = []
  listeners.clear()
  if (current) void current.room.leave()
}

export function peerCount(): number {
  if (!session) return 0
  return Object.keys(session.room.getPeers()).length
}

export function announceHello() {
  session?.send({ t: 'hello', name: handleOrYou() })
}
