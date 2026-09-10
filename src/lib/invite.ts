import type { CategoryId, PaceMode } from '../types'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CAT_CHAR: Record<CategoryId, string> = {
  mix: 'M',
  general: 'G',
  science: 'S',
  history: 'H',
  pop: 'P',
  math: 'A',
  geography: 'E',
  sports: 'O',
}
const CHAR_CAT: Record<string, CategoryId> = {
  M: 'mix',
  G: 'general',
  S: 'science',
  H: 'history',
  P: 'pop',
  A: 'math',
  E: 'geography',
  O: 'sports',
}
const PACE_CHAR: Record<PaceMode, string> = {
  bullet: 'T',
  blitz: 'B',
  rapid: 'R',
}
const CHAR_PACE: Record<string, PaceMode> = {
  T: 'bullet',
  B: 'blitz',
  R: 'rapid',
  N: 'rapid',
}

export function makeInviteToken(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function formatInvite(categoryId: CategoryId, token: string, pace: PaceMode = 'rapid', kind: 'duel' | 'party' = 'duel'): string {
  const body = `${CAT_CHAR[categoryId]}${PACE_CHAR[pace]}`
  return kind === 'party' ? `${body}Y${token.toUpperCase()}` : `${body}${token.toUpperCase()}`
}

export function parseInvite(
  raw: string,
): { categoryId: CategoryId; token: string; code: string; pace: PaceMode; kind: 'duel' | 'party' } | null {
  const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (code.length < 6) return null
  const categoryId = CHAR_CAT[code[0]]
  if (!categoryId) return null

  const party = code.length >= 8 && CHAR_PACE[code[1]] && code[2] === 'Y'
  const paced = !party && code.length >= 7 ? CHAR_PACE[code[1]] : undefined
  if (party) {
    const token = code.slice(3, 8)
    const pace = CHAR_PACE[code[1]] ?? 'rapid'
    if (token.length !== 5) return null
    return { categoryId, token, pace, kind: 'party', code: `${code[0]}${code[1]}Y${token}` }
  }
  const token = paced ? code.slice(2, 7) : code.slice(1, 6)
  const pace = paced ?? 'rapid'
  if (token.length !== 5) return null
  const full = paced ? `${code[0]}${code[1]}${token}` : `${code[0]}${token}`
  return { categoryId, token, pace, kind: 'duel', code: full }
}

export function parseJoinHash(hash: string): { categoryId: CategoryId; token: string; code: string; pace: PaceMode; kind: 'duel' | 'party' } | null {
  const match = hash.match(/^#play\/([A-Za-z0-9]+)/i)
  if (!match) return null
  const invite = parseInvite(match[1])
  if (!invite || invite.kind === 'party') return null
  return invite
}

export function parsePartyHash(hash: string): { categoryId: CategoryId; token: string; code: string; pace: PaceMode; kind: 'duel' | 'party' } | null {
  const match = hash.match(/^#party\/([A-Za-z0-9]+)/i)
  if (!match) return null
  const invite = parseInvite(match[1])
  if (!invite) return null
  return { ...invite, kind: 'party' }
}

export function playHash(code: string): string {
  return `#play/${code}`
}

export function partyHash(code: string): string {
  return `#party/${code}`
}

export function playUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}${playHash(code)}`
}

export function partyUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}${partyHash(code)}`
}

export function roomTopic(code: string): string {
  return `quizline-${code}`
}
