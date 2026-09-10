import { useEffect, useRef } from 'react'
import { getCategory } from '../data/questions'
import { PACE_LABEL, QUESTIONS_PER_MATCH, secondsForPace } from '../lib/game'
import { getPartyRoom, isPartyHostSender, partySelfId } from '../lib/onlineParty'
import type { CategoryId, PaceMode, PartyPlayer, PartyStanding } from '../types'
import { Avatar } from './Avatar'

type Props = {
  categoryId: CategoryId
  code: string
  role: 'host' | 'guest'
  pace: PaceMode
  round: number
  standings: PartyStanding[]
  onLobby: () => void
  onBegin: (players: PartyPlayer[], round: number, goAt: number, categoryId?: CategoryId, pace?: PaceMode) => void
  onHome: () => void
}

const HUES = ['#ff2d6a', '#0ea5e9', '#e39b00', '#6d3dff', '#0ea5a0', '#e86a00', '#ec4899', '#22c55e']

function hueFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % HUES.length
  return HUES[hash]
}

function sortStandings(standings: PartyStanding[]) {
  return [...standings].sort((a, b) => b.score - a.score || b.correct - a.correct)
}

export function PartyResult({ categoryId, code, role, pace, round, standings, onLobby, onBegin, onHome }: Props) {
  const category = getCategory(categoryId)
  const selfId = partySelfId()
  const ranked = sortStandings(standings)
  const winner = ranked[0]
  const podium = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  const you = ranked.find((row) => row.id === selfId)
  const onLobbyRef = useRef(onLobby)
  const onBeginRef = useRef(onBegin)
  const roundRef = useRef(round)
  onLobbyRef.current = onLobby
  onBeginRef.current = onBegin
  roundRef.current = round

  useEffect(() => {
    const room = getPartyRoom()
    if (!room) return undefined
    return room.subscribe((msg) => {
      if (msg.t === 'lobby' && isPartyHostSender(msg.from)) onLobbyRef.current()
      if (msg.t === 'begin' && isPartyHostSender(msg.from) && msg.round > roundRef.current) {
        onBeginRef.current(msg.players, msg.round, msg.at, msg.categoryId, msg.pace)
      }
    })
  }, [code])

  function backToLobby() {
    const room = getPartyRoom()
    if (role === 'host') room?.send({ t: 'lobby', round: 0 })
    onLobby()
  }

  const visual = [podium[1], podium[0], podium[2]].filter(Boolean)
  const placeClass = ['is-silver', 'is-gold', 'is-bronze']

  return (
    <main className="results party-results">
      <header className="results-banner">
        <p className="topic-chip">
          {category?.name ?? 'Party'} · {PACE_LABEL[pace]} {secondsForPace(pace)}s · Party
        </p>
        <h1>{winner ? `${winner.name} wins` : 'Podium'}</h1>
        {winner ? (
          <p className="results-flavor">
            {winner.score.toLocaleString('en-US')} pts · {winner.correct}/{QUESTIONS_PER_MATCH} correct
          </p>
        ) : (
          <p className="results-flavor">Party scores do not count toward 1v1 records.</p>
        )}
      </header>

      <ol className="podium" aria-label="Top three">
        {visual.map((row, visualIndex) => {
          const place = ranked.indexOf(row) + 1
          return (
            <li key={row.id} className={`podium-step ${placeClass[visualIndex]}${row.id === selfId ? ' is-you' : ''}`}>
              <p className="podium-place">{place}</p>
              <Avatar name={row.name} hue={hueFor(row.id)} size="lg" avatar={row.avatar} src={row.photo} />
              <strong>{row.name}</strong>
              <p className="face-pts">{row.score.toLocaleString('en-US')} pts</p>
              <p className="face-hits">
                {row.correct}/{QUESTIONS_PER_MATCH}
              </p>
            </li>
          )
        })}
      </ol>

      {rest.length ? (
        <ol className="party-table" aria-label="Rest of the lobby">
          {rest.map((row, index) => (
            <li key={row.id} className={row.id === selfId ? 'is-you' : ''}>
              <span>{index + 4}</span>
              <Avatar name={row.name} hue={hueFor(row.id)} size="sm" avatar={row.avatar} src={row.photo} />
              <strong>{row.name}</strong>
              <em>{row.score.toLocaleString('en-US')}</em>
            </li>
          ))}
        </ol>
      ) : null}

      {you ? (
        <p className="results-flavor">
          You finished {ranked.findIndex((row) => row.id === you.id) + 1} of {ranked.length} · {you.score.toLocaleString('en-US')} pts
        </p>
      ) : null}

      <div className="results-actions">
        <button type="button" className="play-cta" onClick={backToLobby}>
          Same lobby
        </button>
        <button type="button" className="challenge-btn" onClick={onHome}>
          Home
        </button>
      </div>
    </main>
  )
}
