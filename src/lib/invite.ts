import type { CategoryId } from '../types'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CAT_CHAR: Record<CategoryId, string> = {
  mix: 'M',
  general: 'G',
  science: 'S',
  history: 'H',
  pop: 'P',
}
const CHAR_CAT: Record<string, CategoryId> = {
  M: 'mix',
  G: 'general',
  S: 'science',
  H: 'history',
  P: 'pop',
}

export function makeInviteToken(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export function formatInvite(categoryId: CategoryId, token: string): string {
  return `${CAT_CHAR[categoryId]}${token.toUpperCase()}`
}

export function parseInvite(raw: string): { categoryId: CategoryId; token: string; code: string } | null {
  const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (code.length < 6) return null
  const categoryId = CHAR_CAT[code[0]]
  const token = code.slice(1, 6)
  if (!categoryId || token.length !== 5) return null
  return { categoryId, token, code: `${code[0]}${token}` }
}

export function parseJoinHash(hash: string): { categoryId: CategoryId; token: string; code: string } | null {
  const match = hash.match(/^#play\/([A-Za-z0-9]+)/i)
  if (!match) return null
  return parseInvite(match[1])
}

export function playHash(code: string): string {
  return `#play/${code}`
}

export function playUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}${playHash(code)}`
}

export function roomTopic(code: string): string {
  return `quizline-${code}`
}
