export type CategoryId = 'mix' | 'general' | 'science' | 'history' | 'pop'

export type Question = {
  id: string
  prompt: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
}

export type Category = {
  id: CategoryId
  name: string
  blurb: string
  questions: Question[]
}

export type PlayQuestion = {
  id: string
  prompt: string
  choices: string[]
  correctIndex: number
}

export type Opponent =
  | { kind: 'solo' }
  | { kind: 'bot'; botId: string }
  | { kind: 'local' }

export type Screen =
  | { name: 'home' }
  | { name: 'opponent'; categoryId: CategoryId }
  | { name: 'match'; categoryId: CategoryId; opponent: Opponent }
  | {
      name: 'result'
      categoryId: CategoryId
      opponent: Opponent
      you: { score: number; correct: number }
      them?: { name: string; score: number; correct: number }
      previousBest: number
    }
