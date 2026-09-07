import type { PlayQuestion } from '../types'
import { QUESTIONS_PER_MATCH, shuffle } from '../lib/game'
import type { Category } from '../types'

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const next = [...items]
  let state = hashString(seed) || 1
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

export function dealMatch(category: Category): PlayQuestion[] {
  const pool = category.id === 'mix' ? seededShuffle(category.questions, `mix-${todayKey()}`) : shuffle(category.questions)

  return pool.slice(0, QUESTIONS_PER_MATCH).map((question) => {
    const indexed = question.choices.map((text, index) => ({ text, index }))
    const shuffled = shuffle(indexed)
    return {
      id: question.id,
      prompt: question.prompt,
      choices: shuffled.map((choice) => choice.text),
      correctIndex: shuffled.findIndex((choice) => choice.index === question.correctIndex),
    }
  })
}
