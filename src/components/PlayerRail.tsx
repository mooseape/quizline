import { Avatar } from './Avatar'

type Props = {
  name: string
  tag: string
  hue: string
  score: number
  locked: boolean
  waiting: boolean
  timedOut?: boolean
  avatar?: string | null
  src?: string | null
}

export function PlayerRail({ name, tag, hue, score, locked, waiting, timedOut, avatar, src }: Props) {
  const state = timedOut ? 'Timed out' : locked ? 'Locked in' : waiting ? 'Waiting' : 'Answering'
  return (
    <aside className={`player-rail${locked ? ' is-locked' : ''}${timedOut ? ' is-out' : ''}`}>
      <Avatar name={name} hue={hue} size="md" avatar={avatar} src={src} />
      <div className="rail-copy">
        <strong>{name}</strong>
        <span>{tag}</span>
      </div>
      <p className="rail-score">{score.toLocaleString('en-US')}</p>
      <p className="rail-state">{state}</p>
    </aside>
  )
}
