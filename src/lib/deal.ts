import { getSeenQuestionIds, rememberQuestionIds } from './storage'
import { QUESTIONS_PER_MATCH, shuffle } from './game'
import type { Category, PlayQuestion, Question, QuestionDifficulty } from '../types'

const LEVELS: QuestionDifficulty[] = ['easy', 'medium', 'hard']
const PER_LEVEL: Record<QuestionDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 3,
}

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

function levelOf(question: Question): QuestionDifficulty {
  return question.difficulty ?? 'medium'
}

function mix<T>(items: T[], seed: string | undefined, salt: string) {
  return seed ? seededShuffle(items, `${seed}-${salt}`) : shuffle(items)
}

function pickBalanced(questions: Question[], seed: string | undefined, avoid: Set<string>): Question[] {
  const buckets: Record<QuestionDifficulty, Question[]> = { easy: [], medium: [], hard: [] }
  for (const question of questions) buckets[levelOf(question)].push(question)

  const picked: Question[] = []
  const used = new Set<string>()

  for (const level of LEVELS) {
    const shuffled = mix(buckets[level], seed, level)
    const fresh = shuffled.filter((question) => !avoid.has(question.id))
    const pool = fresh.length >= PER_LEVEL[level] ? fresh : shuffled
    for (const question of pool.slice(0, PER_LEVEL[level])) {
      picked.push(question)
      used.add(question.id)
    }
  }

  if (picked.length < QUESTIONS_PER_MATCH) {
    const rest = mix(questions, seed, 'fill').filter((question) => !used.has(question.id))
    picked.push(...rest.slice(0, QUESTIONS_PER_MATCH - picked.length))
  }

  return mix(picked, seed, 'order')
}

export function dealMatch(category: Category, seed?: string): PlayQuestion[] {
  const seen = seed ? [] : getSeenQuestionIds(category.id)
  const unseenCount = category.questions.filter((question) => !seen.includes(question.id)).length
  const recycled = !seed && unseenCount < QUESTIONS_PER_MATCH
  const avoid = recycled ? new Set<string>() : new Set(seen)
  const dealt = pickBalanced(category.questions, seed, avoid).slice(0, QUESTIONS_PER_MATCH)

  if (!seed) {
    rememberQuestionIds(
      category.id,
      dealt.map((question) => question.id),
      recycled ? dealt.length : category.questions.length,
    )
  }

  return dealt.map((question) => {
    const indexed = question.choices.map((text, index) => ({ text, index }))
    const mixed = mix(indexed, seed, question.id)
    return {
      id: question.id,
      prompt: question.prompt,
      choices: mixed.map((choice) => choice.text),
      correctIndex: mixed.findIndex((choice) => choice.index === question.correctIndex),
      difficulty: levelOf(question),
      flagCode: question.flagCode,
    }
  })
}
