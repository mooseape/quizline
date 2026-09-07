import type { Bot } from '../data/bots'
import { SECONDS_PER_QUESTION } from './game'

export function planBotAnswer(bot: Bot, correctIndex: number, choiceCount: number) {
  const maxDelay = SECONDS_PER_QUESTION * 1000 - 250
  const lo = Math.min(bot.minDelayMs, maxDelay)
  const hi = Math.min(bot.maxDelayMs, maxDelay)
  const delayMs = Math.round(lo + Math.random() * Math.max(0, hi - lo))
  const correct = Math.random() < bot.accuracy
  if (correct) return { delayMs, choiceIndex: correctIndex }

  const wrong = Array.from({ length: choiceCount }, (_, index) => index).filter(
    (index) => index !== correctIndex,
  )
  const choiceIndex = wrong[Math.floor(Math.random() * wrong.length)] ?? 0
  return { delayMs, choiceIndex }
}
