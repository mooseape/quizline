import type { CategoryId, Opponent } from '../types'
import { bots } from '../data/bots'

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
  if (raw === 'mix' || raw === 'general' || raw === 'science' || raw === 'history' || raw === 'pop') {
    return raw
  }
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

export function hasSeenRules(): boolean {
  return localStorage.getItem(SEEN_RULES) === '1'
}

export function markRulesSeen() {
  localStorage.setItem(SEEN_RULES, '1')
}

const STREAK_KEY = 'quizline-streak'

export function getPlayStreak(): number {
  const value = Number(localStorage.getItem(STREAK_KEY) ?? 0)
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function bumpPlayStreak() {
  localStorage.setItem(STREAK_KEY, String(getPlayStreak() + 1))
}
