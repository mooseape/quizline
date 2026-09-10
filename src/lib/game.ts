import type { PaceMode, QuestionDifficulty } from '../types'

export const QUESTIONS_PER_MATCH = 10
export const SECONDS_PER_QUESTION = 10
export const COUNTDOWN_SECONDS = 3
export const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000
export const PARTY_MAX = 8
export const PACE_SECONDS: Record<PaceMode, number> = {
  bullet: 3,
  blitz: 5,
  rapid: 10,
}
export const PACE_LABEL: Record<PaceMode, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
}

export const PACE_MODES: PaceMode[] = ['bullet', 'blitz', 'rapid']

export function isPaceMode(value: unknown): value is PaceMode {
  return value === 'bullet' || value === 'blitz' || value === 'rapid'
}

export function coercePace(value: unknown): PaceMode {
  if (isPaceMode(value)) return value
  return 'rapid'
}

export const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export function secondsForPace(pace: PaceMode) {
  return PACE_SECONDS[pace]
}
export const BASE_POINTS = 100
export const TIME_BONUS = 10
export const DIFFICULTY_SCORE: Record<QuestionDifficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
}

export function scoreAnswer(
  remainingSeconds: number,
  difficulty: QuestionDifficulty = 'easy',
): number {
  if (remainingSeconds < 0) return 0
  const raw = BASE_POINTS + remainingSeconds * TIME_BONUS
  return Math.round(raw * DIFFICULTY_SCORE[difficulty])
}

export const MAX_QUESTION_SCORE = scoreAnswer(10, 'hard')
export const MAX_MATCH_SCORE = MAX_QUESTION_SCORE * QUESTIONS_PER_MATCH

export function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}
