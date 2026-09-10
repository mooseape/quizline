export const AVATAR_IDS = [
  'spark',
  'bolt',
  'kiwi',
  'comet',
  'coral',
  'mint',
  'dusk',
  'lemon',
  'berry',
  'frost',
  'ember',
  'tide',
] as const

export type AvatarId = (typeof AVATAR_IDS)[number]

export const AVATAR_PACK: { id: AvatarId; hue: string; label: string }[] = [
  { id: 'spark', hue: '#ff2d6a', label: 'Spark' },
  { id: 'bolt', hue: '#e39b00', label: 'Bolt' },
  { id: 'kiwi', hue: '#22c55e', label: 'Kiwi' },
  { id: 'comet', hue: '#0ea5e9', label: 'Comet' },
  { id: 'coral', hue: '#f97316', label: 'Coral' },
  { id: 'mint', hue: '#14b8a6', label: 'Mint' },
  { id: 'dusk', hue: '#6d3dff', label: 'Dusk' },
  { id: 'lemon', hue: '#eab308', label: 'Lemon' },
  { id: 'berry', hue: '#ec4899', label: 'Berry' },
  { id: 'frost', hue: '#38bdf8', label: 'Frost' },
  { id: 'ember', hue: '#ef4444', label: 'Ember' },
  { id: 'tide', hue: '#0ea5a0', label: 'Tide' },
]

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value)
}

export function avatarHue(id?: string | null) {
  return AVATAR_PACK.find((item) => item.id === id)?.hue ?? '#ff2d6a'
}

export function parseAvatarId(value: unknown): AvatarId {
  return isAvatarId(value) ? value : 'spark'
}
