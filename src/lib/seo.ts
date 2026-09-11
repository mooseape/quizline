import type { Screen } from '../types'

export const SITE_URL = 'https://quizline-ebon.vercel.app/'

export const DEFAULT_TITLE = 'Quizline — Live trivia vs friends, bots, and randoms'

export function titleForScreen(screen: Screen) {
  switch (screen.name) {
    case 'home':
      return DEFAULT_TITLE
    case 'opponent':
      return 'Choose opponent · Quizline'
    case 'ranked-queue':
      return 'Finding a player · Quizline'
    case 'lobby':
      return 'Friend duel lobby · Quizline'
    case 'match':
      return 'Live match · Quizline'
    case 'result':
      return 'Match results · Quizline'
    case 'party-lobby':
      return 'Party lobby · Quizline'
    case 'party-match':
      return 'Party match · Quizline'
    case 'party-result':
      return 'Party results · Quizline'
    default:
      return DEFAULT_TITLE
  }
}
