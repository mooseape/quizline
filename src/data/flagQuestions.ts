import type { Question, QuestionDifficulty } from '../types'
import { FLAG_NATIONS } from './flagNations'

const EASY = new Set([
  'US', 'GB', 'CA', 'AU', 'FR', 'DE', 'IT', 'ES', 'JP', 'CN', 'IN', 'BR', 'MX', 'RU', 'KR',
  'ZA', 'EG', 'NG', 'AR', 'TR', 'SA', 'SE', 'NO', 'NL', 'BE', 'CH', 'PL', 'PT', 'GR', 'IE',
  'NZ', 'UA', 'TH', 'VN', 'PH', 'ID', 'MY', 'SG', 'PK', 'BD', 'KE', 'GH', 'MA', 'CO', 'PE',
  'CL', 'CU', 'JM', 'FI', 'DK', 'AT', 'CZ',
])

function hashCode(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function picksFor(code: string, name: string): [string, string, string, string] {
  const others = FLAG_NATIONS.filter((row) => row.code !== code)
  let state = hashCode(code) || 1
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
  const pool = [...others]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const wrong = pool.slice(0, 3).map((row) => row.name)
  const slot = Math.floor(next() * 4) as 0 | 1 | 2 | 3
  const choices: [string, string, string, string] = ['', '', '', '']
  let w = 0
  for (let i = 0; i < 4; i += 1) {
    choices[i] = i === slot ? name : wrong[w++]
  }
  return choices
}

function correctIndexOf(choices: [string, string, string, string], name: string): 0 | 1 | 2 | 3 {
  const index = choices.indexOf(name)
  return (index >= 0 ? index : 0) as 0 | 1 | 2 | 3
}

const HARD = new Set(['AD', 'LI', 'MC', 'SM', 'VA', 'NR', 'TV', 'PW', 'MH', 'KI', 'TO', 'FM', 'WS', 'ST', 'KM', 'VU', 'TL', 'XK'])

function difficultyOf(code: string): QuestionDifficulty {
  if (EASY.has(code)) return 'easy'
  if (HARD.has(code)) return 'hard'
  return 'medium'
}

export const flagQuestions: Question[] = FLAG_NATIONS.filter((row) => row.code !== 'IL').map((row) => {
  const choices = picksFor(row.code, row.name)
  return {
    id: `fl-${row.code.toLowerCase()}`,
    prompt: 'Which country is this flag?',
    choices,
    correctIndex: correctIndexOf(choices, row.name),
    difficulty: difficultyOf(row.code),
    flagCode: row.code,
  }
})
