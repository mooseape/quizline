import { useEffect, useRef, useState } from 'react'
import { categories, getCategory } from '../data/questions'
import { useAccount } from '../lib/AccountContext'
import { getHandle } from '../lib/handle'
import { COUNTDOWN_MS, PACE_LABEL, PACE_MODES, QUESTIONS_PER_MATCH, secondsForPace } from '../lib/game'
import { playUrl } from '../lib/invite'
import { announceHello, closeDuelRoom, getDuelRoom, openDuelRoom, peerCount, trackDuelProfile } from '../lib/onlineDuel'
import { isSupabaseConfigured, missingSupabaseMessage } from '../lib/supabase'
import { safeMediaUrl } from '../lib/safeUrl'
import { Avatar } from './Avatar'
import { QrCode } from './QrCode'
import type { CategoryId, PaceMode } from '../types'
import { TOPIC_HUE } from '../lib/topics'

const TOPICS: { id: CategoryId; label: string }[] = [
  { id: 'mix', label: 'Daily Mix' },
  ...categories.map((category) => ({ id: category.id, label: category.name })),
]

function prettyCode(code: string) {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean.length >= 7) return `${clean.slice(0, 4)}-${clean.slice(4)}`
  return clean
}

type Props = {
  categoryId: CategoryId
  code: string
  role: 'host' | 'guest'
  pace: PaceMode
  round: number
  onCancel: () => void
  onSetup: (categoryId: CategoryId, pace: PaceMode) => void
  onStart: (
    categoryId: CategoryId,
    pace: PaceMode,
    round: number,
    goAt: number,
    friendName: string,
    look?: { avatar?: string; photo?: string },
  ) => void
}

export function FriendLobby({ categoryId, code, role, pace, round, onCancel, onSetup, onStart }: Props) {
  const { setName: saveName, avatarId, photoUrl } = useAccount()
  const [name, setName] = useState(() => getHandle())
  const [topic, setTopic] = useState(categoryId)
  const [speed, setSpeed] = useState(pace)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [friendIn, setFriendIn] = useState(false)
  const [friendName, setFriendName] = useState('Friend')
  const [friendLook, setFriendLook] = useState<{ avatar?: string; photo?: string }>({})
  const [status, setStatus] = useState(
    !isSupabaseConfigured()
      ? missingSupabaseMessage()
      : role === 'host'
        ? 'Share the link'
        : 'Joining your friend…',
  )
  const [error, setError] = useState(isSupabaseConfigured() ? '' : missingSupabaseMessage())
  const link = playUrl(code)
  const category = getCategory(topic)
  const nameRef = useRef<HTMLInputElement>(null)
  const onStartRef = useRef(onStart)
  const onSetupRef = useRef(onSetup)
  const startedRef = useRef(false)
  const friendNameRef = useRef(friendName)
  const topicRef = useRef(topic)
  const speedRef = useRef(speed)
  onStartRef.current = onStart
  onSetupRef.current = onSetup
  friendNameRef.current = friendName
  topicRef.current = topic
  speedRef.current = speed
  const topicHue = TOPIC_HUE[topic]
  const waiting = !friendIn

  useEffect(() => {
    setTopic(categoryId)
    setSpeed(pace)
  }, [categoryId, pace])

  useEffect(() => {
    saveName(name)
    void trackDuelProfile()
    announceHello()
  }, [name, saveName])

  useEffect(() => {
    if (editing) nameRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined
    const session = openDuelRoom(code)

    function syncFriend() {
      const inRoom = peerCount() > 0
      setFriendIn(inRoom)
      const room = getDuelRoom()
      if (room?.friendName) setFriendName(room.friendName)
      if (room?.friendAvatar || room?.friendPhoto) {
        setFriendLook({ avatar: room.friendAvatar, photo: room.friendPhoto })
      }
      if (inRoom) {
        const who = room?.friendName || 'Friend'
        setStatus(role === 'host' ? `${who} joined — starting…` : 'Waiting for host to start')
      } else if (role === 'host') {
        setStatus('Waiting for a friend…')
      }
    }

    function pushSetup() {
      if (role !== 'host') return
      session.send({ t: 'setup', categoryId: topicRef.current, pace: speedRef.current })
    }

    session.onPeerJoin = () => {
      announceHello()
      syncFriend()
      pushSetup()
    }
    session.onPeerLeave = () => {
      setFriendIn(false)
      setFriendLook({})
      if (!startedRef.current) setStatus(role === 'host' ? 'Waiting for a friend…' : 'Friend left. Waiting again…')
    }
    session.onPresence = () => {
      syncFriend()
    }

    const stop = session.subscribe((msg) => {
      if (msg.t === 'hello') {
        announceHello()
        setFriendIn(true)
        setFriendName(msg.name || 'Friend')
        setFriendLook({ avatar: msg.avatar, photo: safeMediaUrl(msg.photo) })
        setStatus(role === 'host' ? `${msg.name || 'Friend'} joined — starting…` : 'Waiting for host to start')
        syncFriend()
      }
      if (msg.t === 'setup' && role === 'guest') {
        setTopic(msg.categoryId)
        setSpeed(msg.pace)
        onSetupRef.current(msg.categoryId, msg.pace)
      }
      if (msg.t === 'begin' && role === 'guest' && !startedRef.current) {
        startedRef.current = true
        onStartRef.current(msg.categoryId, msg.pace, msg.round, msg.at, session.friendName || friendNameRef.current, {
          avatar: session.friendAvatar,
          photo: session.friendPhoto,
        })
      }
    })

    void session.ready
      .then(() => {
        announceHello()
        syncFriend()
        if (peerCount() > 0) pushSetup()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not open the live room.')
      })

    return () => {
      stop()
      session.onPeerJoin = null
      session.onPeerLeave = null
      session.onPresence = null
    }
  }, [code, role])

  function applySetup(nextTopic: CategoryId, nextPace: PaceMode) {
    setTopic(nextTopic)
    setSpeed(nextPace)
    onSetup(nextTopic, nextPace)
    openDuelRoom(code).send({ t: 'setup', categoryId: nextTopic, pace: nextPace })
  }

  function start() {
    if (peerCount() < 1) {
      setError('Wait for your friend, then start.')
      return
    }
    setError('')
    startedRef.current = true
    const at = Date.now() + COUNTDOWN_MS
    const session = openDuelRoom(code)
    session.send({ t: 'begin', round, at, categoryId: topic, pace: speed })
    onStart(topic, speed, round, at, session.friendName || friendName, {
      avatar: session.friendAvatar,
      photo: session.friendPhoto,
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setStatus('Copied. Send it.')
      window.setTimeout(() => {
        setCopied(false)
        setStatus(friendIn ? `${friendName} joined — starting…` : 'Waiting for a friend…')
      }, 1600)
    } catch {
      setError('Copy failed — try again.')
    }
  }

  function leave() {
    closeDuelRoom()
    onCancel()
  }

  const youLabel = name.trim() || 'You'

  return (
    <main className="duel-invite" style={{ ['--topic' as string]: topicHue }} data-topic={topic}>
      <header className="duel-invite-top">
        <button type="button" className="party-leave-link" onClick={leave}>
          Cancel
        </button>
        <div className="hero-chips duel-invite-chips">
          <span className="diff-chip duel-topic-chip">{category?.name ?? 'Match'}</span>
          <span className="diff-chip ghost-chip">
            {PACE_LABEL[speed]} {secondsForPace(speed)}s
          </span>
          <span className="diff-chip ghost-chip">Live 1v1</span>
        </div>
      </header>

      <article className="duel-invite-card">
        <p className="eyebrow">Selected match</p>
        <h1>{role === 'host' ? 'Invite a friend' : 'Joining the duel'}</h1>
        <p className="duel-invite-helper">One link, two phones, same {QUESTIONS_PER_MATCH} questions.</p>
        {role === 'host' ? (
          <>
            <div className="mode-row lobby-topics" role="group" aria-label="Topic">
              {TOPICS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`mode-btn${topic === item.id ? ' is-on' : ''}`}
                  onClick={() => applySetup(item.id, speed)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mode-row" role="group" aria-label="Match pace">
              {PACE_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`mode-btn${speed === option ? ' is-on' : ''}`}
                  onClick={() => applySetup(topic, option)}
                >
                  {PACE_LABEL[option]} · {secondsForPace(option)}s
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="duel-faceoff" aria-label="1v1 seats">
          <div className="duel-seat is-you">
            <button type="button" className="duel-seat-hit" onClick={() => setEditing(true)} aria-label="Edit your name">
              <Avatar name={youLabel} avatar={avatarId} src={photoUrl} size="lg" />
            </button>
            {editing ? (
              <input
                ref={nameRef}
                id="handle"
                className="party-name-input"
                value={name}
                maxLength={16}
                placeholder="You"
                aria-label="Your name"
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setEditing(false)}
              />
            ) : (
              <button type="button" className="duel-seat-name" onClick={() => setEditing(true)}>
                <strong>{youLabel}</strong>
                <span>{role === 'host' ? 'Host · Ready' : 'Ready'}</span>
              </button>
            )}
          </div>
          <p className="duel-vs">vs</p>
          <div className={`duel-seat${friendIn ? ' is-in' : ' is-empty'}`}>
            {friendIn ? (
              <Avatar name={friendName} avatar={friendLook.avatar} src={friendLook.photo} size="lg" hue="#0ea5e9" />
            ) : (
              <span className="party-slot-ghost duel-seat-ghost" aria-hidden="true" />
            )}
            <div>
              <strong>{friendIn ? friendName : 'Friend'}</strong>
              <span>{friendIn ? 'Joined' : 'Waiting…'}</span>
            </div>
          </div>
        </div>

        <div className="duel-invite-share">
          <p className="eyebrow">Share this</p>
          <p className="party-code duel-code" aria-label={`Room code ${prettyCode(code)}`}>
            {prettyCode(code)}
          </p>
          <QrCode value={link} size={120} />
          <button type="button" className="challenge-btn duel-copy" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy invite link'}
          </button>
          {role === 'host' ? (
            <button type="button" className="play-cta duel-start" disabled={!friendIn} onClick={start}>
              Start duel
            </button>
          ) : (
            <p className="duel-status">Waiting for host to start</p>
          )}
          <p className={`duel-status${waiting ? ' is-wait' : ''}`}>{status}</p>
          {error ? <p className="lobby-error">{error}</p> : null}
          <button type="button" className="challenge-btn duel-cancel-desk" onClick={leave}>
            Cancel
          </button>
        </div>
      </article>
    </main>
  )
}
