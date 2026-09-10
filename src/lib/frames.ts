export const FRAME_IDS = ['neon', 'gold', 'ice', 'ember', 'dusk'] as const

export type FrameId = (typeof FRAME_IDS)[number]

export const FRAME_PACK: { id: FrameId; label: string }[] = [
  { id: 'neon', label: 'Neon' },
  { id: 'gold', label: 'Gold' },
  { id: 'ice', label: 'Ice' },
  { id: 'ember', label: 'Ember' },
  { id: 'dusk', label: 'Dusk' },
]

export function isFrameId(value: unknown): value is FrameId {
  return typeof value === 'string' && (FRAME_IDS as readonly string[]).includes(value)
}

export function parseFrameId(value: unknown): FrameId | null {
  return isFrameId(value) ? value : null
}
