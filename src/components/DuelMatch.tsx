import { useEffect, useMemo, useRef, useState } from 'react'
import { getBot } from '../data/bots'
import { getCategory } from '../data/questions'
import { planBotAnswer } from '../lib/bot'
import { dealMatch } from '../lib/deal'
import { QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION, scoreAnswer } from '../lib/game'
import type { CategoryId, Opponent } from '../types'
import { HalfGlow } from './HalfGlow'
import { PlayerPane } from './PlayerPane'
import { TimerRail } from './TimerRail'

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

export function DuelMatch({ categoryId, opponent, onQuit, onFinish }: Props) {
  const category = getCategory(categoryId)
  const bot = opponent.kind === 'bot' ? getBot(opponent.botId) : undefined
  const themName = opponent.kind === 'local' ? 'Friend' : (bot?.name ?? 'Opponent')
  const themTag =
    opponent.kind === 'local' ? 'Pass-and-play' : bot ? `${bot.difficulty} bot` : 'Opponent'

  const deck = useMemo(() => (category ? dealMatch(category) : []), [category])
  const [index, setIndex] = useState(0)
  const [remainingMs, setRemainingMs] = useState(QUESTION_MS)
  const [reveal, setReveal] = useState(false)
  const [you, setYou] = useState<SideState>({ picked: null, score: 0, correct: 0, streak: 0 })
  const [them, setThem] = useState<SideState>({ picked: null, score: 0, correct: 0, streak: 0 })

  const youRef = useRef(you)
  const themRef = useRef(them)
  const indexRef = useRef(0)
  const remainingRef = useRef(QUESTION_MS)
  const resolvedRef = useRef(false)
  const advanceRef = useRef<number | null>(null)

  youRef.current = you
  themRef.current = them

  const question = deck[index]
  const ratio = remainingMs / QUESTION_MS
  const halfway = !reveal && remainingMs > 0 && ratio <= 0.5

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

    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    advanceRef.current = window.setTimeout(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= deck.length) {
        onFinish(
          { score: youRef.current.score, correct: youRef.current.correct },
          { name: themName, score: themRef.current.score, correct: themRef.current.correct },
        )
        return
      }
      indexRef.current = nextIndex
      resolvedRef.current = false
      remainingRef.current = QUESTION_MS
      setIndex(nextIndex)
      setRemainingMs(QUESTION_MS)
      setReveal(false)
      setYou((value) => ({ ...value, picked: null }))
      setThem((value) => ({ ...value, picked: null }))
    }, 900)
  }

  function choose(side: 'you' | 'them', choiceIndex: number) {
    if (resolvedRef.current || !question) return
    const current = side === 'you' ? youRef.current : themRef.current
    if (current.picked !== null) return

    const remainingSeconds = Math.max(0, Math.floor(remainingRef.current / 1000))
    const isCorrect = choiceIndex === question.correctIndex
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

  useEffect(() => {
    if (!question || reveal) return undefined
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const left = Math.max(0, QUESTION_MS - (now - started))
      remainingRef.current = left
      setRemainingMs(left)
      if (left <= 0) {
        finishQuestion()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [question, reveal, index])

  useEffect(() => {
    if (!question || !bot || reveal) return undefined
    const plan = planBotAnswer(bot, question.correctIndex, question.choices.length)
    const id = window.setTimeout(() => {
      choose('them', plan.choiceIndex)
    }, plan.delayMs)
    return () => window.clearTimeout(id)
  }, [question, bot, reveal, index])

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

  return (
    <main className="duel">
      <HalfGlow active={halfway} />
      <div className="duel-top">
        <header className="duel-meta">
          <button type="button" className="ghost" onClick={onQuit}>
            Exit
          </button>
          <p>
            {category.name} · {index + 1}/{QUESTIONS_PER_MATCH}
          </p>
        </header>
        <PlayerPane
          name="You"
          tag="Top screen"
          score={you.score}
          question={question}
          picked={you.picked}
          locked={reveal || you.picked !== null}
          reveal={reveal}
          interactive
          onChoose={(choice) => choose('you', choice)}
        />
      </div>
      <TimerRail ratio={ratio} secondsLeft={Math.ceil(remainingMs / 1000)} />
      <div className="duel-bottom">
        <PlayerPane
          name={themName}
          tag={themTag}
          score={them.score}
          question={question}
          picked={them.picked}
          locked={reveal || them.picked !== null || opponent.kind === 'bot'}
          reveal={reveal}
          interactive={opponent.kind === 'local'}
          onChoose={(choice) => choose('them', choice)}
        />
      </div>
    </main>
  )
}
