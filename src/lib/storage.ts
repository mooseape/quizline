import type { CategoryId, Opponent, PaceMode } from '../types'
import { isPaceMode } from './game'
import { bots } from '../data/bots'
import { isCategoryId } from './topics'

const key = (categoryId: CategoryId) => `quizline-best-${categoryId}`
const LAST_CATEGORY = 'quizline-last-category'
const LAST_OPPONENT = 'quizline-last-opponent'
const SEEN_RULES = 'quizline-seen-rules'

export const DEFAULT_OPPONENT: Opponent = { kind: 'bot', botId: 'peter' }

export function getBestScore(categoryId: CategoryId): number {
  const raw = localStorage.getItem(key(categoryId))
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? Math.round(value) : 0
}

export function saveBestScore(categoryId: CategoryId, score: number): number {
  const best = Math.max(getBestScore(categoryId), score)
  localStorage.setItem(key(categoryId), String(best))
  return best
}

export function getLastCategory(): CategoryId {
  const raw = localStorage.getItem(LAST_CATEGORY)
  if (isCategoryId(raw)) return raw
  return 'mix'
}

export function saveLastCategory(categoryId: CategoryId) {
  localStorage.setItem(LAST_CATEGORY, categoryId)
}

export function getLastOpponent(): Opponent {
  const raw = localStorage.getItem(LAST_OPPONENT)
  if (!raw) return DEFAULT_OPPONENT
  try {
    const parsed = JSON.parse(raw) as Opponent
    if (parsed.kind === 'solo' || parsed.kind === 'local') return parsed
    if (parsed.kind === 'bot' && bots.some((bot) => bot.id === parsed.botId)) return parsed
  } catch {
    return DEFAULT_OPPONENT
  }
  return DEFAULT_OPPONENT
}

export function saveLastOpponent(opponent: Opponent) {
  localStorage.setItem(LAST_OPPONENT, JSON.stringify(opponent))
}

const LAST_PACE = 'quizline-last-pace'

export function getLastPace(): PaceMode {
  const raw = localStorage.getItem(LAST_PACE)
  if (isPaceMode(raw)) return raw
  return 'rapid'
}

export function saveLastPace(pace: PaceMode) {
  localStorage.setItem(LAST_PACE, pace)
}

export function hasSeenRules(): boolean {
  return localStorage.getItem(SEEN_RULES) === '1'
}

export function markRulesSeen() {
  localStorage.setItem(SEEN_RULES, '1')
}

function seenKey(categoryId: string) {
  return `quizline-seen-${categoryId}`
}

export function getSeenQuestionIds(categoryId: string): string[] {
  try {
    const raw = localStorage.getItem(seenKey(categoryId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function rememberQuestionIds(categoryId: string, ids: string[], poolSize: number) {
  const unique = [...new Set(ids)]
  const previous = getSeenQuestionIds(categoryId).filter((id) => !unique.includes(id))
  const next = [...unique, ...previous].slice(0, Math.max(poolSize, unique.length))
  localStorage.setItem(seenKey(categoryId), JSON.stringify(next))
}

export function clearSeenQuestionIds(categoryId: string) {
  localStorage.removeItem(seenKey(categoryId))
}
