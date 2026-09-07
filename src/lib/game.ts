export const QUESTIONS_PER_MATCH = 10
export const SECONDS_PER_QUESTION = 15
export const BASE_POINTS = 100
export const TIME_BONUS = 10
export const STREAK_BONUS = 15

export function scoreAnswer(remainingSeconds: number, streak: number): number {
  if (remainingSeconds < 0) return 0
  return BASE_POINTS + remainingSeconds * TIME_BONUS + streak * STREAK_BONUS
}

export function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}
