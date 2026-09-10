import { avatarHue, type AvatarId } from '../lib/avatars'
import { parseFrameId } from '../lib/frames'
import { safeMediaUrl } from '../lib/safeUrl'

type Props = {
  name: string
  hue?: string
  size?: 'sm' | 'md' | 'lg'
  avatar?: string | null
  src?: string | null
  frame?: string | null
}

const FACE: Record<string, { l: [number, number]; r: [number, number]; smile: number; cheek?: boolean }> = {
  spark: { l: [22, 26], r: [42, 26], smile: 8, cheek: true },
  bolt: { l: [20, 24], r: [44, 28], smile: 2 },
  kiwi: { l: [23, 28], r: [41, 28], smile: 10, cheek: true },
  comet: { l: [21, 25], r: [43, 25], smile: 6 },
  coral: { l: [24, 27], r: [40, 27], smile: 12, cheek: true },
  mint: { l: [22, 29], r: [42, 25], smile: 4 },
  dusk: { l: [23, 24], r: [41, 24], smile: 0 },
  lemon: { l: [20, 27], r: [44, 27], smile: 9, cheek: true },
  berry: { l: [24, 26], r: [40, 26], smile: 11 },
  frost: { l: [22, 25], r: [42, 29], smile: 5 },
  ember: { l: [21, 26], r: [43, 26], smile: -2 },
  tide: { l: [23, 27], r: [41, 27], smile: 7, cheek: true },
}

function FaceMark({ id, hue }: { id: string; hue: string }) {
  const face = FACE[id] ?? FACE.spark
  const mouthD =
    face.smile >= 6
      ? 'M24 40c4 8 12 8 16 0'
      : face.smile <= 0
        ? 'M26 42c4-4 8-4 12 0'
        : 'M26 41h12'
  return (
    <svg viewBox="0 0 64 64" className="avatar-face" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={hue} />
      <circle cx="32" cy="36" r="22" fill="rgba(255,255,255,0.18)" />
      {face.cheek ? (
        <>
          <circle cx="16" cy="36" r="5" fill="rgba(255,255,255,0.22)" />
          <circle cx="48" cy="36" r="5" fill="rgba(255,255,255,0.22)" />
        </>
      ) : null}
      <circle cx={face.l[0]} cy={face.l[1]} r="4.2" fill="#1a0b16" />
      <circle cx={face.r[0]} cy={face.r[1]} r="4.2" fill="#1a0b16" />
      <circle cx={face.l[0] - 1} cy={face.l[1] - 1} r="1.2" fill="white" />
      <circle cx={face.r[0] - 1} cy={face.r[1] - 1} r="1.2" fill="white" />
      <path d={mouthD} fill="none" stroke="#1a0b16" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function Avatar({ name, hue = '#ff2d6a', size = 'md', avatar, src, frame }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const tint = avatar ? avatarHue(avatar as AvatarId) : hue
  const frameId = parseFrameId(frame)
  return (
    <span
      className={`avatar-shell avatar-shell-${size}${frameId ? ` is-framed is-${frameId}` : ''}`}
      data-frame={frameId ?? undefined}
      aria-hidden="true"
    >
      <span className={`avatar avatar-${size}`} style={{ background: tint }}>
        {src ? <img className="avatar-photo" src={safeMediaUrl(src) ?? undefined} alt="" /> : null}
        {!src && avatar ? <FaceMark id={avatar} hue={tint} /> : null}
        {!src && !avatar ? initial : null}
      </span>
      {frameId ? <span className="avatar-frame" /> : null}
    </span>
  )
}
