import type { PaceMode, QuestionDifficulty } from '../types'

export const QUESTIONS_PER_MATCH = 10
export const SECONDS_PER_QUESTION = 15
export const COUNTDOWN_SECONDS = 3
export const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000
export const PARTY_MAX = 8
export const PACE_SECONDS: Record<PaceMode, number> = {
  blitz: 5,
  rapid: 10,
  normal: 15,
}
export const PACE_LABEL: Record<PaceMode, string> = {
  blitz: 'Blitz',
  rapid: 'Rapid',
  normal: 'Normal',
}

export const PACE_MODES: PaceMode[] = ['blitz', 'rapid', 'normal']

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
export const STREAK_BONUS = 15
export const DIFFICULTY_SCORE: Record<QuestionDifficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
}

export function scoreAnswer(
  remainingSeconds: number,
  streak: number,
  difficulty: QuestionDifficulty = 'easy',
): number {
  if (remainingSeconds < 0) return 0
  const raw = BASE_POINTS + remainingSeconds * TIME_BONUS + streak * STREAK_BONUS
  return Math.round(raw * DIFFICULTY_SCORE[difficulty])
}

export const MAX_QUESTION_SCORE = scoreAnswer(15, QUESTIONS_PER_MATCH - 1, 'hard')
export const MAX_MATCH_SCORE = MAX_QUESTION_SCORE * QUESTIONS_PER_MATCH

export function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}
