export type PaceMode = 'bullet' | 'blitz' | 'rapid'

export type CategoryId = 'mix' | 'general' | 'science' | 'history' | 'pop' | 'math' | 'geography' | 'sports'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export type Question = {
  id: string
  prompt: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  difficulty?: QuestionDifficulty
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
  difficulty: QuestionDifficulty
}

export type PartyPlayer = {
  id: string
  name: string
  host?: boolean
  avatar?: string
  photo?: string
  frame?: string
}

export type PartyStanding = PartyPlayer & {
  score: number
  correct: number
}

export type Opponent =
  | { kind: 'solo' }
  | { kind: 'bot'; botId: string }
  | { kind: 'local' }
  | { kind: 'online'; roomId: string; role: 'host' | 'guest'; friendName: string; friendAvatar?: string; friendPhoto?: string; friendFrame?: string; ranked?: boolean; opponentId?: string }

export type Screen =
  | { name: 'home' }
  | { name: 'opponent'; categoryId: CategoryId }
  | { name: 'ranked-queue'; categoryId: CategoryId; pace: PaceMode }
  | { name: 'lobby'; categoryId: CategoryId; code: string; role: 'host' | 'guest'; pace: PaceMode; round: number }
  | { name: 'match'; categoryId: CategoryId; opponent: Opponent; pace: PaceMode; round?: number; goAt?: number }
  | {
      name: 'result'
      categoryId: CategoryId
      opponent: Opponent
      pace: PaceMode
      you: { score: number; correct: number }
      them?: { name: string; score: number; correct: number }
      previousBest: number
      round?: number
    }
  | {
      name: 'party-lobby'
      categoryId: CategoryId
      code: string
      role: 'host' | 'guest'
      pace: PaceMode
      round: number
    }
  | {
      name: 'party-match'
      categoryId: CategoryId
      code: string
      role: 'host' | 'guest'
      pace: PaceMode
      round: number
      players: PartyPlayer[]
      goAt: number
    }
  | {
      name: 'party-result'
      categoryId: CategoryId
      code: string
      role: 'host' | 'guest'
      pace: PaceMode
      round: number
      standings: PartyStanding[]
    }
