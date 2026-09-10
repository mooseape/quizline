import { useEffect, useMemo, useRef, useState } from 'react'
import { getBot } from '../data/bots'
import { getCategory } from '../data/questions'
import { planBotAnswer } from '../lib/bot'
import { dealMatch } from '../lib/deal'
import { COUNTDOWN_MS, COUNTDOWN_SECONDS, DIFFICULTY_LABEL, MAX_MATCH_SCORE, MAX_QUESTION_SCORE, PACE_LABEL, QUESTIONS_PER_MATCH, secondsForPace, scoreAnswer } from '../lib/game'
import { getDuelRoom } from '../lib/onlineDuel'
import { useAccount } from '../lib/AccountContext'
import type { CategoryId, Opponent, PaceMode, PlayQuestion } from '../types'
import { HalfGlow } from './HalfGlow'
import { MatchCountdown } from './MatchCountdown'
import { MatchTimer } from './MatchTimer'
import { PlayerRail } from './PlayerRail'

type SideState = {
  picked: number | null
  score: number
  correct: number
  streak: number
}

type Props = {
  categoryId: CategoryId
  opponent: Opponent
  pace?: PaceMode
  round?: number
  goAt?: number
  onQuit: () => void
  onLobby?: () => void
  onFinish: (you: { score: number; correct: number }, them: { name: string; score: number; correct: number }) => void
}

const TOPIC_HUE: Record<CategoryId, string> = {
  mix: '#ff2d6a',
  general: '#e39b00',
  science: '#0ea5a0',
  history: '#e86a00',
  pop: '#6d3dff',
}

const PREVIEW_QUESTION: PlayQuestion = {
  id: 'preview-fortnite',
  prompt: 'Fortnite is primarily a…',
  choices: ['Cooking show', 'Video game', 'Board game only', 'Radio station'],
  correctIndex: 1,
  difficulty: 'medium',
}

function previewMode() {
  return typeof window !== 'undefined' && window.location.hash.startsWith('#preview-duel')
}

export function DuelMatch({ categoryId, opponent, pace = 'normal', round = 0, goAt, onQuit, onLobby, onFinish }: Props) {
  const youLook = useAccount()
  const preview = previewMode()
  const previewReveal = typeof window !== 'undefined' && window.location.hash === '#preview-duel-reveal'
  const questionMs = secondsForPace(pace) * 1000
  const online = opponent.kind === 'online'
  const isHost = online && opponent.role === 'host'
  const category = getCategory(categoryId)
  const bot = opponent.kind === 'bot' ? getBot(opponent.botId) : undefined
  const room = online ? getDuelRoom() : null
  const themName =
    opponent.kind === 'online'
      ? opponent.friendName || room?.friendName || 'Friend'
      : opponent.kind === 'local'
        ? 'Friend'
        : (bot?.name ?? 'Opponent')
  const themTag =
    opponent.kind === 'online'
      ? 'Live 1v1'
      : opponent.kind === 'local'
        ? 'Same device'
        : bot
          ? `${bot.difficulty} bot`
          : 'Opponent'
  const themHue = bot?.hue ?? '#0ea5e9'
  const topicHue = TOPIC_HUE[categoryId]
  const seed = online ? `${opponent.roomId}-r${round}` : undefined

  const deck = useMemo(() => {
    if (preview) return [PREVIEW_QUESTION]
    return category ? dealMatch(category, seed) : []
  }, [categoryId, preview, seed])

  const [index, setIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(previewReveal ? 0 : preview ? 11000 : questionMs)
  const [countingDown, setCountingDown] = useState(!preview)
  const [countSec, setCountSec] = useState(COUNTDOWN_SECONDS)
  const [reveal, setReveal] = useState(previewReveal)
  const [friendGone, setFriendGone] = useState(false)
  const [you, setYou] = useState<SideState>({ picked: null, score: 0, correct: 0, streak: 0 })
  const [them, setThem] = useState<SideState>(
    preview
      ? { picked: 1, score: 240, correct: 1, streak: 1 }
      : { picked: null, score: 0, correct: 0, streak: 0 },
  )

  const youRef = useRef(you)
  const themRef = useRef(them)
  const indexRef = useRef(0)
  const remainingRef = useRef(remainingMs)
  const resolvedRef = useRef(previewReveal)
  const countingDownRef = useRef(!preview)
  const advanceRef = useRef<number | null>(null)
  const clockAtRef = useRef<number | null>(null)
  const goAtRef = useRef<number | null>(preview ? Date.now() : (goAt ?? Date.now() + COUNTDOWN_MS))
  const themPickIRef = useRef(-1)
  const themNameRef = useRef(themName)
  const onFinishRef = useRef(onFinish)
  const onLobbyRef = useRef(onLobby)

  onFinishRef.current = onFinish
  onLobbyRef.current = onLobby
  themNameRef.current = themName
  countingDownRef.current = countingDown

  const question = deck[index]

  function publishYou() {
    if (!online) return
    const y = youRef.current
    room?.send({
      t: 'pick',
      i: indexRef.current,
      c: y.picked ?? -1,
      s: Math.max(0, Math.floor(remainingRef.current / 1000)),
      score: y.score,
      correct: y.correct,
      streak: y.streak,
    })
  }

  function applyThemSync(msg: { i: number; c: number; s: number; score?: number; correct?: number; streak?: number }) {
    if (typeof msg.s === 'number' && (msg.s < 0 || msg.s > 15)) return
    if (typeof msg.score === 'number') {
      if (msg.i < themPickIRef.current) return
      if (msg.score < themRef.current.score || msg.score > MAX_MATCH_SCORE) return
      if (msg.score > themRef.current.score + MAX_QUESTION_SCORE) return
      if (typeof msg.correct === 'number') {
        if (msg.correct < themRef.current.correct || msg.correct > themRef.current.correct + 1) return
        if (msg.correct > QUESTIONS_PER_MATCH) return
      }
      themPickIRef.current = msg.i
      const next: SideState = {
        picked: msg.c >= 0 ? msg.c : null,
        score: msg.score,
        correct: msg.correct ?? themRef.current.correct,
        streak: msg.streak ?? themRef.current.streak,
      }
      themRef.current = next
      setThem(next)
      if (!resolvedRef.current && msg.i === indexRef.current && msg.c >= 0 && youRef.current.picked !== null) {
        finishQuestion()
      }
      return
    }
    if (msg.i === indexRef.current) applyPick('them', msg.c, msg.s)
  }

  function applyPick(side: 'you' | 'them', choiceIndex: number, remainingSeconds: number) {
    const currentQ = deck[indexRef.current]
    if (resolvedRef.current || countingDownRef.current || !currentQ) return
    const current = side === 'you' ? youRef.current : themRef.current
    if (current.picked !== null) return

    const isCorrect = choiceIndex === currentQ.correctIndex
    const gained = isCorrect ? scoreAnswer(remainingSeconds, current.streak, currentQ.difficulty) : 0
    const next: SideState = {
      picked: choiceIndex,
      score: current.score + gained,
      correct: current.correct + (isCorrect ? 1 : 0),
      streak: isCorrect ? current.streak + 1 : 0,
    }
    if (side === 'you') {
      youRef.current = next
      setYou(next)
    } else {
      themRef.current = next
      setThem(next)
    }

    const other = side === 'you' ? themRef.current : youRef.current
    if (other.picked !== null) finishQuestion()
  }

  function beginQuestion(nextIndex: number, at: number) {
    indexRef.current = nextIndex
    resolvedRef.current = false
    countingDownRef.current = false
    clockAtRef.current = at
    remainingRef.current = questionMs
    youRef.current = { ...youRef.current, picked: null }
    themRef.current = { ...themRef.current, picked: null }
    setCountingDown(false)
    setIndex(nextIndex)
    setRemainingMs(questionMs)
    setReveal(false)
    setYou(youRef.current)
    setThem(themRef.current)
  }

  function finishQuestion() {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setReveal(true)

    const youNow = youRef.current
    const themNow = themRef.current
    if (youNow.picked === null) {
      const next = { ...youNow, streak: 0 }
      youRef.current = next
      setYou(next)
    }
    if (themNow.picked === null) {
      const next = { ...themNow, streak: 0 }
      themRef.current = next
      setThem(next)
    }

    if (preview) return
    if (online) publishYou()
    if (online && isHost) room?.send({ t: 'reveal', i: indexRef.current })
    if (online && !isHost) return

    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    const settleMs = online && indexRef.current + 1 >= deck.length ? 1600 : 1100
    advanceRef.current = window.setTimeout(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= deck.length) {
        if (online) publishYou()
        if (online && isHost) room?.send({ t: 'go', i: nextIndex, at: Date.now() })
        onFinishRef.current(
          { score: youRef.current.score, correct: youRef.current.correct },
          { name: themNameRef.current, score: themRef.current.score, correct: themRef.current.correct },
        )
        return
      }
      const at = Date.now()
      beginQuestion(nextIndex, at)
      if (online && isHost) room?.send({ t: 'go', i: nextIndex, at })
    }, settleMs)
  }

  function chooseYou(choiceIndex: number) {
    if (countingDownRef.current) return
    const remainingSeconds = Math.max(0, Math.floor(remainingRef.current / 1000))
    applyPick('you', choiceIndex, remainingSeconds)
    publishYou()
  }

  useEffect(() => {
    if (preview || !countingDown) return undefined
    let frame = 0
    const tick = () => {
      const until = goAtRef.current
      if (until == null) {
        setCountSec(COUNTDOWN_SECONDS)
        frame = requestAnimationFrame(tick)
        return
      }
      const left = until - Date.now()
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
  }, [countingDown, preview, questionMs])

  useEffect(() => {
    if (!question || reveal || preview || countingDown) return undefined
    const started = performance.now()
    const startLeft = remainingRef.current
    let frame = 0
    const tick = (now: number) => {
      const left = Math.max(0, startLeft - (now - started))
      remainingRef.current = left
      setRemainingMs(left)
      if (left <= 0) {
        if (!online || isHost) finishQuestion()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [question, reveal, index, preview, online, isHost, countingDown])

  useEffect(() => {
    if (!question || !bot || reveal || preview || countingDown || themRef.current.picked !== null) return undefined
    const plan = planBotAnswer(bot, question.correctIndex, question.choices.length, pace)
    const id = window.setTimeout(() => {
      applyPick('them', plan.choiceIndex, Math.max(0, Math.floor(remainingRef.current / 1000)))
    }, plan.delayMs)
    return () => window.clearTimeout(id)
  }, [question, bot, reveal, index, preview, pace, countingDown])

  useEffect(() => {
    function syncPreviewHash() {
      if (window.location.hash === '#preview-duel-reveal') {
        setReveal(true)
        setRemainingMs(0)
      }
    }
    syncPreviewHash()
    window.addEventListener('hashchange', syncPreviewHash)
    return () => window.removeEventListener('hashchange', syncPreviewHash)
  }, [])

  useEffect(() => {
    if (!online || !room) return undefined
    let acked = isHost
    let startTimer = 0

    function sendStart(forceNewClock = false) {
      let at = clockAtRef.current ?? goAtRef.current ?? Date.now()
      if (forceNewClock || clockAtRef.current == null) {
        at = indexRef.current === 0 ? (goAtRef.current ?? Date.now() + COUNTDOWN_MS) : Date.now()
      }
      clockAtRef.current = at
      room?.send({ t: 'start', i: indexRef.current, at })
    }

    if (isHost) {
      sendStart(true)
      startTimer = window.setInterval(() => {
        if (!acked) sendStart()
      }, 800)
    } else {
      room.send({ t: 'need' })
    }

    const stop = room.subscribe((msg) => {
      if (msg.t === 'lobby') {
        onLobbyRef.current?.()
        return
      }
      if (msg.t === 'hello' && msg.name) themNameRef.current = msg.name
      if (msg.t === 'need' && isHost) sendStart()
      if (msg.t === 'here' && isHost) acked = true
      if (msg.t === 'start' && !isHost) {
        room.send({ t: 'here' })
        if (youRef.current.picked !== null) return
        clockAtRef.current = msg.at
        if (msg.i === 0 && Date.now() < msg.at) {
          goAtRef.current = msg.at
          countingDownRef.current = true
          setCountingDown(true)
          return
        }
        if (msg.i !== indexRef.current) {
          beginQuestion(msg.i, msg.at)
          return
        }
        countingDownRef.current = false
        setCountingDown(false)
        const elapsed = Date.now() - msg.at
        if (elapsed > 250 && elapsed < questionMs) {
          remainingRef.current = Math.max(0, questionMs - elapsed)
          setRemainingMs(remainingRef.current)
        }
      }
      if (msg.t === 'pick') {
        applyThemSync(msg)
      }
      if (msg.t === 'reveal' && !isHost && msg.i === indexRef.current) {
        finishQuestion()
      }
      if (msg.t === 'go' && !isHost) {
        if (msg.i >= deck.length) {
          onFinishRef.current(
            { score: youRef.current.score, correct: youRef.current.correct },
            { name: themNameRef.current, score: themRef.current.score, correct: themRef.current.correct },
          )
          return
        }
        beginQuestion(msg.i, msg.at)
      }
    })

    room.onPeerJoin = () => {
      setFriendGone(false)
      if (isHost) sendStart()
      else room.send({ t: 'need' })
    }
    room.onPeerLeave = () => {
      setFriendGone(true)
      acked = false
    }

    return () => {
      stop()
      if (startTimer) window.clearInterval(startTimer)
      room.onPeerJoin = null
      room.onPeerLeave = null
    }
  }, [online, isHost, room, deck.length])

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current)
    }
  }, [])

  if (!category || !question) {
    return (
      <main className="panel">
        <p>That match could not start.</p>
        <button type="button" className="ghost" onClick={onQuit}>
          Back
        </button>
      </main>
    )
  }

  const youLocked = you.picked !== null
  const themLocked = them.picked !== null
  const halfGone = !countingDown && remainingMs > 0 && remainingMs <= questionMs / 2

  return (
    <main className={`playfield${halfGone && !preview ? ' is-urgent' : ''}`} style={{ ['--topic' as string]: topicHue }}>
      {countingDown ? <MatchCountdown seconds={countSec} /> : null}
      <HalfGlow active={!preview && halfGone} />
      <header className="play-top">
        <button type="button" className="exit-btn" onClick={onQuit}>
          Exit
        </button>
        <p className="topic-chip">{category.name}</p>
        {pace !== 'normal' ? <p className="topic-chip ghost-chip">{PACE_LABEL[pace]}</p> : null}
        <p className="top-clock" aria-hidden="true">
          {Math.max(0, Math.ceil(remainingMs / 1000))}
          <span>s</span>
        </p>
        <div className="q-progress" aria-label={`Question ${index + 1} of ${QUESTIONS_PER_MATCH}`}>
          {Array.from({ length: QUESTIONS_PER_MATCH }, (_, i) => (
            <span key={i} className={i === index ? 'is-now' : i < index ? 'is-done' : ''} />
          ))}
          <em>
            {index + 1}/{QUESTIONS_PER_MATCH}
          </em>
        </div>
      </header>

      {friendGone ? <p className="lock-banner">Friend reconnecting… you can still answer</p> : null}

      <div className="play-body">
        <PlayerRail
          name={youLook.name || 'You'}
          tag={online ? 'Live' : 'Playing'}
          hue="#ff2d6a"
          score={you.score}
          locked={youLocked}
          waiting={!youLocked}
          timedOut={reveal && !youLocked}
          avatar={youLook.avatarId}
          src={youLook.photoUrl}
        />

        <section className="play-center">
          <MatchTimer remainingMs={remainingMs} totalMs={questionMs} />
          <h1>{question.prompt}</h1>
          <p className="q-diff">{DIFFICULTY_LABEL[question.difficulty]}</p>
          <div className="answer-wrap">
            <div className="lock-slot" aria-live="polite">
              {themLocked && !reveal ? <p className="lock-banner">{themName} locked in</p> : null}
              {youLocked && !reveal ? <p className="lock-banner you-lock">You locked in</p> : null}
            </div>
            <ol className="answer-grid">
            {question.choices.map((choice, choiceIndex) => {
              const yours = you.picked === choiceIndex
              const theirs = them.picked === choiceIndex
              const classes = ['answer']
              if (!reveal && yours) classes.push('is-picked')
              if (reveal && choiceIndex === question.correctIndex) classes.push('is-right')
              if (reveal && yours && choiceIndex !== question.correctIndex) classes.push('is-wrong')
              if (reveal && theirs) classes.push('is-theirs')
              return (
                <li key={`${question.id}-${choice}`}>
                  <button
                    type="button"
                    className={classes.join(' ')}
                    disabled={countingDown || reveal || youLocked}
                    onClick={() => chooseYou(choiceIndex)}
                  >
                    {choice}
                    {reveal && theirs ? <span className="pick-tag">{themName}</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
          </div>
        </section>

        <PlayerRail
          name={themName}
          tag={themTag}
          hue={themHue}
          score={them.score}
          locked={themLocked}
          waiting={!themLocked}
          timedOut={reveal && !themLocked}
          avatar={opponent.kind === 'online' ? opponent.friendAvatar : undefined}
          src={opponent.kind === 'online' ? opponent.friendPhoto : undefined}
        />
      </div>
    </main>
  )
}
