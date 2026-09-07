import { useEffect, useMemo, useRef, useState } from 'react'
import { getCategory } from '../data/questions'
import { dealMatch } from '../lib/deal'
import { QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION, scoreAnswer } from '../lib/game'
import type { CategoryId } from '../types'

type Props = {
  categoryId: CategoryId
  onQuit: () => void
  onFinish: (score: number, correct: number) => void
}

export function Match({ categoryId, onQuit, onFinish }: Props) {
  const category = getCategory(categoryId)
  const deck = useMemo(() => (category ? dealMatch(category) : []), [category])
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState(SECONDS_PER_QUESTION)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const indexRef = useRef(0)
  const resolvedRef = useRef(false)
  const advanceRef = useRef<number | null>(null)

  const question = deck[index]
  const locked = picked !== null || seconds === 0

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
      setSeconds(SECONDS_PER_QUESTION)
      setPicked(null)
    }, 850)
  }

  useEffect(() => {
    if (!question || locked) return undefined
    const id = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [question, locked])

  useEffect(() => {
    if (seconds !== 0 || picked !== null || !question) return
    setStreak(0)
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
    const gained = isCorrect ? scoreAnswer(seconds, streak) : 0
    const nextScore = score + gained
    const nextCorrect = correctCount + (isCorrect ? 1 : 0)
    scoreRef.current = nextScore
    correctRef.current = nextCorrect
    setPicked(choiceIndex)
    setStreak(isCorrect ? streak + 1 : 0)
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
    <main className="panel match">
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
        <span style={{ width: `${(seconds / SECONDS_PER_QUESTION) * 100}%` }} />
      </div>
      <p className="clock">{seconds}s</p>
      <h2>{question.prompt}</h2>
      <ol className="choices">
        {question.choices.map((choice, choiceIndex) => {
          let tone = ''
          if (locked) {
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
