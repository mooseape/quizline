import type { Bot } from '../data/bots'
import { secondsForPace } from './game'
import type { PaceMode } from '../types'

export function planBotAnswer(
  bot: Bot,
  correctIndex: number,
  choiceCount: number,
  pace: PaceMode = 'normal',
) {
  const maxDelay = Math.max(200, secondsForPace(pace) * 1000 - 250)
  const scale = maxDelay / (15 * 1000 - 250)
  const lo = Math.min(bot.minDelayMs * scale, maxDelay)
  const hi = Math.min(bot.maxDelayMs * scale, maxDelay)
  const delayMs = Math.round(lo + Math.random() * Math.max(0, hi - lo))
  const correct = Math.random() < bot.accuracy
  if (correct) return { delayMs, choiceIndex: correctIndex }

  const wrong = Array.from({ length: choiceCount }, (_, index) => index).filter(
    (index) => index !== correctIndex,
  )
  const choiceIndex = wrong[Math.floor(Math.random() * wrong.length)] ?? 0
  return { delayMs, choiceIndex }
}
