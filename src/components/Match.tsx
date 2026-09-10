import { useEffect, useMemo, useRef, useState } from 'react'
import { getCategory } from '../data/questions'
import { dealMatch } from '../lib/deal'
import { COUNTDOWN_SECONDS, DIFFICULTY_LABEL, QUESTIONS_PER_MATCH, secondsForPace, scoreAnswer } from '../lib/game'
import type { CategoryId, PaceMode } from '../types'
import { HalfGlow } from './HalfGlow'
import { MatchCountdown } from './MatchCountdown'

type Props = {
  categoryId: CategoryId
  pace?: PaceMode
  onQuit: () => void
  onFinish: (score: number, correct: number) => void
}

export function Match({ categoryId, pace = 'rapid', onQuit, onFinish }: Props) {
  const questionSeconds = secondsForPace(pace)
  const category = getCategory(categoryId)
  const deck = useMemo(() => (category ? dealMatch(category) : []), [categoryId])
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState(questionSeconds)
  const [countingDown, setCountingDown] = useState(true)
  const [countSec, setCountSec] = useState(COUNTDOWN_SECONDS)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const indexRef = useRef(0)
  const resolvedRef = useRef(false)
  const advanceRef = useRef<number | null>(null)

  const question = deck[index]
  const answered = picked !== null || seconds === 0
  const locked = countingDown || answered
  const halfGone = !countingDown && seconds > 0 && seconds <= questionSeconds / 2

  function goNext() {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    advanceRef.current = window.setTimeout(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= deck.length) {
        onFinish(scoreRef.current, correctRef.current)
        return
      }
      indexRef.current = nextIndex
      resolvedRef.current = false
      setIndex(nextIndex)
      setSeconds(questionSeconds)
      setPicked(null)
    }, 850)
  }

  useEffect(() => {
    if (!countingDown) return undefined
    const until = Date.now() + COUNTDOWN_SECONDS * 1000
    let frame = 0
    const tick = () => {
      const left = until - Date.now()
      if (left <= 0) {
        setCountingDown(false)
        setCountSec(0)
        setSeconds(questionSeconds)
        return
      }
      setCountSec(Math.max(1, Math.ceil(left / 1000)))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [countingDown, questionSeconds])

  useEffect(() => {
    if (!question || locked || countingDown) return undefined
    const id = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [question, locked])

  useEffect(() => {
    if (countingDown || seconds !== 0 || picked !== null || !question) return
    goNext()
  }, [seconds, picked, question])

  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current)
    }
  }, [])

  function choose(choiceIndex: number) {
    if (locked || !question) return
    const isCorrect = choiceIndex === question.correctIndex
    const gained = isCorrect ? scoreAnswer(seconds, question.difficulty) : 0
    const nextScore = score + gained
    const nextCorrect = correctCount + (isCorrect ? 1 : 0)
    scoreRef.current = nextScore
    correctRef.current = nextCorrect
    setPicked(choiceIndex)
    setScore(nextScore)
    setCorrectCount(nextCorrect)
    goNext()
  }

  if (!category || !question) {
    return (
      <main className="panel">
        <p>That category is missing.</p>
        <button type="button" className="ghost" onClick={onQuit}>
          Back
        </button>
      </main>
    )
  }

  return (
    <main className={`panel match${halfGone ? ' is-urgent' : ''}`}>
      {countingDown ? <MatchCountdown seconds={countSec} /> : null}
      <HalfGlow active={halfGone} />
      <header className="match-bar">
        <button type="button" className="ghost" onClick={onQuit}>
          Exit
        </button>
        <p>
          {category.name} · {index + 1}/{QUESTIONS_PER_MATCH}
        </p>
        <p className="score">{score} pts</p>
      </header>
      <div className="timer" aria-label={`${seconds} seconds left`}>
        <span style={{ width: `${(seconds / questionSeconds) * 100}%` }} />
      </div>
      <p className="clock">{seconds}s</p>
      <h2>{question.prompt}</h2>
      <p className="q-diff">{DIFFICULTY_LABEL[question.difficulty]}</p>
      <ol className="choices">
        {question.choices.map((choice, choiceIndex) => {
          let tone = ''
          if (answered && !countingDown) {
            if (choiceIndex === question.correctIndex) tone = 'right'
            else if (choiceIndex === picked) tone = 'wrong'
          }
          return (
            <li key={`${question.id}-${choice}`}>
              <button
                type="button"
                className={`choice ${tone}`}
                disabled={locked}
                onClick={() => choose(choiceIndex)}
              >
                {choice}
              </button>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
