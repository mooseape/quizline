import { useEffect, useMemo, useRef, useState } from 'react'
import { getBot } from '../data/bots'
import { getCategory } from '../data/questions'
import { planBotAnswer } from '../lib/bot'
import { dealMatch } from '../lib/deal'
import { QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION, scoreAnswer } from '../lib/game'
import { getDuelRoom } from '../lib/onlineDuel'
import type { CategoryId, Opponent, PlayQuestion } from '../types'
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
  onQuit: () => void
  onFinish: (you: { score: number; correct: number }, them: { name: string; score: number; correct: number }) => void
}

const QUESTION_MS = SECONDS_PER_QUESTION * 1000

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
}

function previewMode() {
  return typeof window !== 'undefined' && window.location.hash.startsWith('#preview-duel')
}

export function DuelMatch({ categoryId, opponent, onQuit, onFinish }: Props) {
  const preview = previewMode()
  const previewReveal = typeof window !== 'undefined' && window.location.hash === '#preview-duel-reveal'
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
  const seed = online ? opponent.roomId : undefined

  const deck = useMemo(() => {
    if (preview) return [PREVIEW_QUESTION]
    return category ? dealMatch(category, seed) : []
  }, [category, preview, seed])

  const [index, setIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(previewReveal ? 0 : preview ? 11000 : QUESTION_MS)
  const [reveal, setReveal] = useState(previewReveal)
  const [waitingStart, setWaitingStart] = useState(online && !isHost)
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
  const advanceRef = useRef<number | null>(null)
  const clockAtRef = useRef<number | null>(null)
  const themNameRef = useRef(themName)
  const onFinishRef = useRef(onFinish)

  youRef.current = you
  themRef.current = them
  themNameRef.current = themName
  onFinishRef.current = onFinish

  const question = deck[index]

  function applyPick(side: 'you' | 'them', choiceIndex: number, remainingSeconds: number) {
    const currentQ = deck[indexRef.current]
    if (resolvedRef.current || !currentQ) return
    const current = side === 'you' ? youRef.current : themRef.current
    if (current.picked !== null) return

    const isCorrect = choiceIndex === currentQ.correctIndex
    const gained = isCorrect ? scoreAnswer(remainingSeconds, current.streak) : 0
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
    clockAtRef.current = at
    remainingRef.current = QUESTION_MS
    setIndex(nextIndex)
    setRemainingMs(QUESTION_MS)
    setReveal(false)
    setWaitingStart(false)
    setYou((value) => ({ ...value, picked: null }))
    setThem((value) => ({ ...value, picked: null }))
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
    if (online && isHost) room?.send({ t: 'reveal', i: indexRef.current })
    if (online && !isHost) return

    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    advanceRef.current = window.setTimeout(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= deck.length) {
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
    }, 1100)
  }

  function chooseYou(choiceIndex: number) {
    const remainingSeconds = Math.max(0, Math.floor(remainingRef.current / 1000))
    applyPick('you', choiceIndex, remainingSeconds)
    if (online) room?.send({ t: 'pick', i: indexRef.current, c: choiceIndex, s: remainingSeconds })
  }

  useEffect(() => {
    if (!question || reveal || preview || waitingStart) return undefined
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
  }, [question, reveal, index, preview, waitingStart, online, isHost])

  useEffect(() => {
    if (!question || !bot || reveal || preview || themRef.current.picked !== null) return undefined
    const plan = planBotAnswer(bot, question.correctIndex, question.choices.length)
    const id = window.setTimeout(() => {
      applyPick('them', plan.choiceIndex, Math.max(0, Math.floor(remainingRef.current / 1000)))
    }, plan.delayMs)
    return () => window.clearTimeout(id)
  }, [question, bot, reveal, index, preview])

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
    if (isHost) {
      const at = Date.now()
      clockAtRef.current = at
      room.send({ t: 'start', i: 0, at })
    }

    const stop = room.subscribe((msg) => {
      if (msg.t === 'hello' && msg.name) themNameRef.current = msg.name
      if (msg.t === 'start' && !isHost) {
        beginQuestion(msg.i, msg.at)
      }
      if (msg.t === 'pick' && msg.i === indexRef.current) {
        applyPick('them', msg.c, msg.s)
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

    room.room.onPeerLeave = () => {
      setWaitingStart(true)
    }

    return () => {
      stop()
      room.room.onPeerLeave = null
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

  return (
    <main className="playfield" style={{ ['--topic' as string]: topicHue }}>
      <header className="play-top">
        <button type="button" className="exit-btn" onClick={onQuit}>
          Exit
        </button>
        <p className="topic-chip">{category.name}</p>
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

      {waitingStart ? <p className="lock-banner">Waiting for the other player…</p> : null}

      <div className="play-body">
        <PlayerRail
          name="You"
          tag={online ? 'Live' : 'Playing'}
          hue="#ff2d6a"
          score={you.score}
          locked={youLocked}
          waiting={!youLocked}
          timedOut={reveal && !youLocked}
        />

        <section className="play-center">
          <MatchTimer remainingMs={waitingStart ? QUESTION_MS : remainingMs} totalMs={QUESTION_MS} />
          <h1>{question.prompt}</h1>
          {themLocked && !reveal ? <p className="lock-banner">{themName} locked in</p> : null}
          {youLocked && !reveal ? <p className="lock-banner you-lock">You locked in</p> : null}
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
                    disabled={reveal || youLocked || waitingStart}
                    onClick={() => chooseYou(choiceIndex)}
                  >
                    {choice}
                    {reveal && theirs ? <span className="pick-tag">{themName}</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <PlayerRail
          name={themName}
          tag={themTag}
          hue={themHue}
          score={them.score}
          locked={themLocked}
          waiting={!themLocked}
          timedOut={reveal && !themLocked}
        />
      </div>
    </main>
  )
}
