import type { CategoryId } from '../types'

export const TOPIC_HUE: Record<CategoryId, string> = {
  mix: '#ff2d6a',
  general: '#e39b00',
  science: '#0ea5a0',
  history: '#e86a00',
  pop: '#6d3dff',
  math: '#2563eb',
  geography: '#16a34a',
  sports: '#e11d48',
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TOPIC_HUE, value)
}
