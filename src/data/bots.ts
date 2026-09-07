export type BotId = 'peter' | 'maya' | 'rex' | 'lina'

export type Bot = {
  id: BotId
  name: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert'
  blurb: string
  accuracy: number
  minDelayMs: number
  maxDelayMs: number
  rank: string
  points: number
  bestTopic: string
  hue: string
}

export const bots: Bot[] = [
  {
    id: 'peter',
    name: 'Peter',
    difficulty: 'Easy',
    blurb: 'Friendly, a bit slow, often second-guesses.',
    accuracy: 0.42,
    minDelayMs: 5500,
    maxDelayMs: 12000,
    rank: 'Bronze II',
    points: 860,
    bestTopic: 'Pop Culture',
    hue: '#3b82f6',
  },
  {
    id: 'maya',
    name: 'Maya',
    difficulty: 'Medium',
    blurb: 'Solid trivia habits, answers at a steady pace.',
    accuracy: 0.7,
    minDelayMs: 2800,
    maxDelayMs: 8000,
    rank: 'Silver I',
    points: 2140,
    bestTopic: 'Science',
    hue: '#ec4899',
  },
  {
    id: 'rex',
    name: 'Rex',
    difficulty: 'Hard',
    blurb: 'Fast reads and sharp guesses under pressure.',
    accuracy: 0.88,
    minDelayMs: 900,
    maxDelayMs: 4200,
    rank: 'Gold III',
    points: 4810,
    bestTopic: 'History',
    hue: '#f97316',
  },
  {
    id: 'lina',
    name: 'Lina',
    difficulty: 'Expert',
    blurb: 'Almost never misses, and barely uses the clock.',
    accuracy: 0.96,
    minDelayMs: 400,
    maxDelayMs: 2200,
    rank: 'Diamond I',
    points: 9020,
    bestTopic: 'General Knowledge',
    hue: '#8b5cf6',
  },
]

export function getBot(id: string) {
  return bots.find((bot) => bot.id === id)
}
