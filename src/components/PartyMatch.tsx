import { useEffect, useMemo, useRef, useState } from 'react'
import { getCategory } from '../data/questions'
import { dealMatch } from '../lib/deal'
import {
  COUNTDOWN_SECONDS,
  DIFFICULTY_LABEL,
  PACE_LABEL,
  QUESTIONS_PER_MATCH,
  secondsForPace,
  scoreAnswer,
} from '../lib/game'
import { clearPartyBegin, getPartyRoom, isPartyHostSender, isPartySeat, partySelfId } from '../lib/onlineParty'
import type { CategoryId, PaceMode, PartyPlayer, PartyStanding } from '../types'
import { TOPIC_HUE } from '../lib/topics'
import { Avatar } from './Avatar'
import { HalfGlow } from './HalfGlow'
import { MatchCountdown } from './MatchCountdown'
import { MatchTimer } from './MatchTimer'

type Seat = {
  id: string
  name: string
  avatar?: string
  photo?: string
  frame?: string
  picked: number | null
  score: number
  correct: number
}

type Props = {
  categoryId: CategoryId
  code: string
  role: 'host' | 'guest'
  pace: PaceMode
  round: number
  players: PartyPlayer[]
  goAt: number
  onQuit: () => void
  onFinish: (standings: PartyStanding[]) => void
}

const HUES = ['#ff2d6a', '#0ea5e9', '#e39b00', '#6d3dff', '#0ea5a0', '#e86a00', '#ec4899', '#22c55e']

function hueFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % HUES.length
  return HUES[hash]
}

function emptySeats(players: PartyPlayer[]): Seat[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    photo: player.photo,
    frame: player.frame,
    picked: null,
    score: 0,
    correct: 0,
  }))
}

export function PartyMatch({
  categoryId,
  code,
  role,
  pace,
  round,
  players,
  goAt,
  onQuit,
  onFinish,
}: Props) {
  const questionMs = secondsForPace(pace) * 1000
  const isHost = role === 'host'
  const category = getCategory(categoryId)
  const room = getPartyRoom()
  const selfId = partySelfId()
  const topicHue = TOPIC_HUE[categoryId]
  const seed = `${code}-r${round}`

  const deck = useMemo(() => (category ? dealMatch(category, seed) : []), [categoryId, seed])

  const [index, setIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(questionMs)
  const [countingDown, setCountingDown] = useState(Date.now() < goAt)
  const [countSec, setCountSec] = useState(COUNTDOWN_SECONDS)
  const [reveal, setReveal] = useState(false)
  const [seats, setSeats] = useState(() => emptySeats(players))

  const seatsRef = useRef(seats)
  const indexRef = useRef(0)
  const remainingRef = useRef(remainingMs)
  const resolvedRef = useRef(false)
  const countingDownRef = useRef(countingDown)
  const goAtRef = useRef(goAt)
  const advanceRef = useRef<number | null>(null)
  const onFinishRef = useRef(onFinish)

  seatsRef.current = seats
  onFinishRef.current = onFinish
  countingDownRef.current = countingDown

  const question = deck[index]
  const you = seats.find((seat) => seat.id === selfId)
  const youLocked = you?.picked !== null

  function standingsNow(): PartyStanding[] {
    return seatsRef.current.map((seat) => ({
      id: seat.id,
      name: seat.name,
      avatar: seat.avatar,
      photo: seat.photo,
      frame: seat.frame,
      score: seat.score,
      correct: seat.correct,
    }))
  }

  function applyPick(playerId: string, choiceIndex: number, remainingSeconds: number) {
    const currentQ = deck[indexRef.current]
    if (resolvedRef.current || countingDownRef.current || !currentQ) return
    const current = seatsRef.current.find((seat) => seat.id === playerId)
    if (!current || current.picked !== null) return

    const isCorrect = choiceIndex === currentQ.correctIndex
    const gained = isCorrect ? scoreAnswer(remainingSeconds, currentQ.difficulty) : 0
    const next = seatsRef.current.map((seat) =>
      seat.id === playerId
        ? {
            ...seat,
            picked: choiceIndex,
            score: seat.score + gained,
            correct: seat.correct + (isCorrect ? 1 : 0),
          }
        : seat,
    )
    seatsRef.current = next
    setSeats(next)
    if (next.every((seat) => seat.picked !== null)) finishQuestion()
  }

  function beginQuestion(nextIndex: number) {
    indexRef.current = nextIndex
    resolvedRef.current = false
    countingDownRef.current = false
    remainingRef.current = questionMs
    setCountingDown(false)
    setIndex(nextIndex)
    setRemainingMs(questionMs)
    setReveal(false)
    setSeats((value) => {
      const next = value.map((seat) => ({ ...seat, picked: null }))
      seatsRef.current = next
      return next
    })
  }

  function finishQuestion() {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setReveal(true)

    if (!isHost) return
    room?.send({ t: 'reveal', i: indexRef.current })

    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    advanceRef.current = window.setTimeout(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= deck.length) {
        clearPartyBegin()
        room?.send({ t: 'go', i: nextIndex, at: Date.now() })
        onFinishRef.current(standingsNow())
        return
      }
      const at = Date.now()
      beginQuestion(nextIndex)
      room?.send({ t: 'go', i: nextIndex, at })
    }, 1100)
  }

  function choose(choiceIndex: number) {
    if (countingDownRef.current || youLocked || reveal) return
    const remainingSeconds = Math.max(0, Math.floor(remainingRef.current / 1000))
    applyPick(selfId, choiceIndex, remainingSeconds)
    room?.send({ t: 'pick', i: indexRef.current, c: choiceIndex, s: remainingSeconds, id: selfId })
  }

  useEffect(() => {
    if (!countingDown) return undefined
    let frame = 0
    const tick = () => {
      const left = goAtRef.current - Date.now()
      if (left <= 0) {
        countingDownRef.current = false
        setCountingDown(false)
        setCountSec(0)
        remainingRef.current = questionMs
        setRemainingMs(questionMs)
        return
      }
      setCountSec(Math.max(1, Math.ceil(left / 1000)))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [countingDown, questionMs])

  useEffect(() => {
    if (!question || reveal || countingDown) return undefined
    const started = performance.now()
    const startLeft = remainingRef.current
    let frame = 0
    const tick = (now: number) => {
      const left = Math.max(0, startLeft - (now - started))
      remainingRef.current = left
      setRemainingMs(left)
      if (left <= 0) {
        if (isHost) finishQuestion()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [question, reveal, index, countingDown, isHost])

  useEffect(() => {
    if (!room) return undefined
    const stop = room.subscribe((msg) => {
      if (msg.t === 'pick' && msg.i === indexRef.current && msg.id !== selfId && isPartySeat(msg.from) && msg.from === msg.id) {
        applyPick(msg.id, msg.c, msg.s)
      }
      if (msg.t === 'reveal' && !isHost && isPartyHostSender(msg.from) && msg.i === indexRef.current) {
        finishQuestion()
      }
      if (msg.t === 'go' && !isHost && isPartyHostSender(msg.from)) {
        if (msg.i >= deck.length) {
          clearPartyBegin()
          onFinishRef.current(standingsNow())
          return
        }
        beginQuestion(msg.i)
      }
    })
    return stop
  }, [room, isHost, deck.length, selfId])

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current)
    }
  }, [])

  if (!category || !question) {
    return (
      <main className="panel">
        <p>That party could not start.</p>
        <button type="button" className="ghost" onClick={onQuit}>
          Back
        </button>
      </main>
    )
  }

  const halfGone = !countingDown && remainingMs > 0 && remainingMs <= questionMs / 2

  return (
    <main className={`playfield party-play${halfGone ? ' is-urgent' : ''}`} style={{ ['--topic' as string]: topicHue }}>
      {countingDown ? <MatchCountdown seconds={countSec} /> : null}
      <HalfGlow active={halfGone} />
      <header className="play-top">
        <button type="button" className="exit-btn" onClick={onQuit}>
          Exit
        </button>
        <p className="topic-chip">{category.name}</p>
        <p className="topic-chip ghost-chip">Party</p>
        {pace !== 'rapid' ? <p className="topic-chip ghost-chip">{PACE_LABEL[pace]}</p> : null}
        <div className="q-progress" aria-label={`Question ${index + 1} of ${QUESTIONS_PER_MATCH}`}>
          {Array.from({ length: QUESTIONS_PER_MATCH }, (_, i) => (
            <span key={i} className={i === index ? 'is-now' : i < index ? 'is-done' : ''} />
          ))}
          <em>
            {index + 1}/{QUESTIONS_PER_MATCH}
          </em>
        </div>
      </header>

      <div className="party-play-body">
        <ul className="party-board" aria-label="Party scores">
          {seats.map((seat) => (
            <li
              key={seat.id}
              className={`party-seat${seat.id === selfId ? ' is-you' : ''}${seat.picked !== null ? ' is-locked' : ''}${reveal && seat.picked === null ? ' is-out' : ''}`}
            >
              <Avatar name={seat.name} hue={hueFor(seat.id)} size="sm" avatar={seat.avatar} src={seat.photo} frame={seat.frame} />
              <span className="party-seat-name">{seat.name}{seat.id === selfId ? ' (you)' : ''}</span>
              <strong>{seat.score.toLocaleString('en-US')}</strong>
              <em>{reveal && seat.picked === null ? 'Timed out' : seat.picked !== null ? 'Locked in' : 'Waiting'}</em>
            </li>
          ))}
        </ul>

        <section className="play-center">
          <MatchTimer remainingMs={remainingMs} totalMs={questionMs} />
          <h1>{question.prompt}</h1>
          <p className="q-diff">{DIFFICULTY_LABEL[question.difficulty]}</p>
          <div className="answer-wrap">
            <div className="lock-slot" aria-live="polite">
              {youLocked && !reveal ? <p className="lock-banner you-lock">You locked in</p> : null}
            </div>
            <ol className="answer-grid">
            {question.choices.map((choice, choiceIndex) => {
              const yours = you?.picked === choiceIndex
              const names = reveal
                ? seats.filter((seat) => seat.picked === choiceIndex).map((seat) => seat.name)
                : []
              const classes = ['answer']
              if (!reveal && yours) classes.push('is-picked')
              if (reveal && choiceIndex === question.correctIndex) classes.push('is-right')
              if (reveal && yours && choiceIndex !== question.correctIndex) classes.push('is-wrong')
              if (reveal && names.length) classes.push('is-theirs')
              return (
                <li key={`${question.id}-${choice}`}>
                  <button
                    type="button"
                    className={classes.join(' ')}
                    disabled={countingDown || reveal || Boolean(youLocked)}
                    onClick={() => choose(choiceIndex)}
                  >
                    {choice}
                    {names.length ? <span className="pick-tag">{names.join(', ')}</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
          </div>
        </section>
      </div>
    </main>
  )
}
