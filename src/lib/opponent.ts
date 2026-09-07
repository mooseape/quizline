import { getBot } from '../data/bots'
import type { Opponent } from '../types'

export function opponentLine(opponent: Opponent) {
  if (opponent.kind === 'solo') return 'Practice'
  if (opponent.kind === 'local') return 'Friend'
  if (opponent.kind === 'online') return opponent.friendName || 'Friend'
  const bot = getBot(opponent.botId)
  return bot ? `${bot.name} · ${bot.difficulty}` : 'Bot'
}
