import { useEffect, useRef, useState } from 'react'
import { categories, getCategory } from '../data/questions'
import { useAccount } from '../lib/AccountContext'
import { getHandle } from '../lib/handle'
import { COUNTDOWN_MS, PACE_LABEL, PACE_MODES, PARTY_MAX, secondsForPace } from '../lib/game'
import { partyUrl } from '../lib/invite'
import {
  announcePartyHello,
  closePartyRoom,
  isPartyHostSender,
  listPartyPlayers,
  openPartyRoom,
  partySelfId,
  trackPartyProfile,
} from '../lib/onlineParty'
import { isSupabaseConfigured, missingSupabaseMessage } from '../lib/supabase'
import type { CategoryId, PaceMode, PartyPlayer } from '../types'
import { TOPIC_HUE } from '../lib/topics'
import { Avatar } from './Avatar'

const TOPICS: { id: CategoryId; label: string }[] = [
  { id: 'mix', label: 'Daily Mix' },
  ...categories.map((category) => ({ id: category.id, label: category.name })),
]

type Props = {
  categoryId: CategoryId
  code: string
  role: 'host' | 'guest'
  pace: PaceMode
  round: number
  onCancel: () => void
  onSetup: (categoryId: CategoryId, pace: PaceMode) => void
  onStart: (players: PartyPlayer[], round: number, goAt: number, categoryId: CategoryId, pace: PaceMode) => void
}

const HUES = ['#ff2d6a', '#0ea5e9', '#e39b00', '#6d3dff', '#0ea5a0', '#e86a00', '#ec4899', '#22c55e']
const HOST_HUE = '#e3b341'

function hueFor(player: PartyPlayer) {
  if (player.host) return HOST_HUE
  let hash = 0
  for (let i = 0; i < player.id.length; i += 1) hash = (hash + player.id.charCodeAt(i)) % HUES.length
  return HUES[hash]
}

function prettyCode(code: string) {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean.length >= 8) return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`
  return clean
}

export function PartyLobby({ categoryId, code, role, pace, round, onCancel, onSetup, onStart }: Props) {
  const { setName: saveName, avatarId, photoUrl } = useAccount()
  const [name, setName] = useState(getHandle)
  const [topic, setTopic] = useState(categoryId)
  const [speed, setSpeed] = useState(pace)
  const [copied, setCopied] = useState(false)
  const [players, setPlayers] = useState<PartyPlayer[]>(() => [
    { id: partySelfId(), name: getHandle() || 'You', host: role === 'host', avatar: avatarId, photo: photoUrl ?? undefined },
  ])
  const [error, setError] = useState(isSupabaseConfigured() ? '' : missingSupabaseMessage())
  const link = partyUrl(code)
  const category = getCategory(topic)
  const onStartRef = useRef(onStart)
  const onSetupRef = useRef(onSetup)
  const roundRef = useRef(round)
  const topicRef = useRef(topic)
  const speedRef = useRef(speed)
  onStartRef.current = onStart
  onSetupRef.current = onSetup
  roundRef.current = round
  topicRef.current = topic
  speedRef.current = speed
  const selfId = partySelfId()
  const you = players.find((player) => player.id === selfId)
  const seats = Array.from({ length: PARTY_MAX }, (_, index) => players[index] ?? null)

  useEffect(() => {
    setTopic(categoryId)
    setSpeed(pace)
  }, [categoryId, pace])

  useEffect(() => {
    saveName(name)
    void trackPartyProfile(role === 'host')
  }, [name, role, saveName, avatarId, photoUrl])

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined
    const session = openPartyRoom(code, role === 'host')
    setPlayers(listPartyPlayers())

    function refresh() {
      setPlayers(listPartyPlayers())
    }

    function pushSetup() {
      if (role !== 'host') return
      session.send({ t: 'setup', categoryId: topicRef.current, pace: speedRef.current })
    }

    session.onPresence = () => {
      refresh()
      pushSetup()
    }

    const stop = session.subscribe((msg) => {
      if (msg.t === 'hello') {
        refresh()
        pushSetup()
      }
      if (msg.t === 'setup' && role === 'guest' && isPartyHostSender(msg.from)) {
        setTopic(msg.categoryId)
        setSpeed(msg.pace)
        onSetupRef.current(msg.categoryId, msg.pace)
      }
      if (msg.t === 'begin' && msg.round === roundRef.current && isPartyHostSender(msg.from)) {
        onStartRef.current(
          msg.players,
          msg.round,
          msg.at,
          msg.categoryId ?? topicRef.current,
          msg.pace ?? speedRef.current,
        )
      }
    })

    void session.ready
      .then(() => {
        announcePartyHello()
        void trackPartyProfile(role === 'host')
        refresh()
        pushSetup()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not open the party room.')
      })

    return () => {
      stop()
      session.onPresence = null
    }
  }, [code, role])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Copy failed — tap the code and copy the invite yourself.')
    }
  }

  function applySetup(nextTopic: CategoryId, nextPace: PaceMode) {
    setTopic(nextTopic)
    setSpeed(nextPace)
    onSetup(nextTopic, nextPace)
    openPartyRoom(code, true).send({ t: 'setup', categoryId: nextTopic, pace: nextPace })
  }

  function start() {
    const roster = listPartyPlayers()
    if (roster.length < 2) {
      setError('Wait for at least one friend, then start.')
      return
    }
    if (roster.length > PARTY_MAX) {
      setError(`Party max is ${PARTY_MAX}.`)
      return
    }
    setError('')
    const session = openPartyRoom(code, true)
    const at = Date.now() + COUNTDOWN_MS
    session.send({
      t: 'begin',
      round,
      at,
      i: 0,
      players: roster,
      categoryId: topic,
      pace: speed,
    })
    onStart(roster, round, at, topic, speed)
  }

  function leave() {
    closePartyRoom()
    onCancel()
  }

  const topicHue = TOPIC_HUE[topic]
  const displayName = name.trim() || 'You'

  return (
    <main className="party-room" style={{ ['--topic' as string]: topicHue }} data-topic={topic}>
      <header className="party-room-top">
        <button type="button" className="party-leave-link" onClick={leave}>
          Leave
        </button>
        <div className="hero-chips party-top-chips">
          <span className="diff-chip">{category?.name ?? 'Match'}</span>
          <span className="diff-chip ghost-chip">
            {PACE_LABEL[speed]} {secondsForPace(speed)}s
          </span>
          <span className="diff-chip ghost-chip">Party</span>
        </div>
        <p className="streak-chip party-cap" aria-label={`${players.length} of ${PARTY_MAX} in the room`}>
          {players.length}/{PARTY_MAX}
        </p>
      </header>

      <section className="party-shell">
        <div className="party-col">
          <p className="eyebrow">Waiting room</p>
          <h1>{role === 'host' ? 'Party lobby' : 'Joining the party'}</h1>
          <p className="party-helper">
            {role === 'host'
              ? 'Pick the topic and pace, invite friends, then hit Start when everyone is in.'
              : 'Party scores stay off your 1v1 record. Wait for the host to pick the match and start.'}
          </p>

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

          <article className="party-you">
            <p className="eyebrow">You</p>
            <div className="party-you-row">
              <Avatar
                name={displayName}
                hue={role === 'host' ? HOST_HUE : hueFor(you ?? { id: selfId, name: displayName })}
                avatar={avatarId}
                src={photoUrl}
                size="lg"
              />
              <div className="party-you-meta">
                <label className="lobby-label" htmlFor="party-handle">
                  Your name
                </label>
                <input
                  id="party-handle"
                  className="party-name-input"
                  value={name}
                  maxLength={16}
                  placeholder="You"
                  onChange={(event) => setName(event.target.value)}
                />
                {role === 'host' ? <span className="diff-chip ghost-chip">Host</span> : null}
              </div>
            </div>
          </article>

          <article className="party-invite">
            <p className="eyebrow">Share this</p>
            <p className="party-code" aria-label={`Room code ${prettyCode(code)}`}>
              {prettyCode(code)}
            </p>
            <p className="party-invite-hint">Anyone with the link can join</p>
            <button type="button" className="challenge-btn party-copy" onClick={() => void copyLink()}>
              {copied ? 'Copied' : 'Copy invite'}
            </button>
          </article>

          <div className="party-dock">
            {role === 'host' ? (
              <button type="button" className="play-cta party-start" disabled={players.length < 2} onClick={start}>
                Start party
              </button>
            ) : (
              <p className="waiting-line party-wait-host">Waiting for host</p>
            )}
            <button type="button" className="party-leave-link party-leave-dock" onClick={leave}>
              Leave
            </button>
            {error ? <p className="lobby-error">{error}</p> : null}
          </div>
        </div>

        <aside className="party-col party-seats-col">
          <p className="eyebrow">In the room · {players.length}/{PARTY_MAX}</p>
          <ul className="party-seats" aria-label="Party seats">
            {seats.map((player, index) =>
              player ? (
                <li key={player.id} className={`party-slot is-in${player.id === selfId ? ' is-you' : ''}${player.host ? ' is-host' : ''}`}>
                  <Avatar name={player.name} hue={hueFor(player)} size="md" avatar={player.avatar} src={player.photo} />
                  <div>
                    <strong>{player.name}</strong>
                    {player.host ? <span>Host</span> : player.id === selfId ? <span>You</span> : <span>Ready</span>}
                  </div>
                </li>
              ) : (
                <li key={`empty-${index}`} className="party-slot is-empty">
                  <span className="party-slot-ghost" aria-hidden="true" />
                  <div>
                    <strong>Waiting…</strong>
                    <span>Open seat</span>
                  </div>
                </li>
              ),
            )}
          </ul>
        </aside>
      </section>
    </main>
  )
}
