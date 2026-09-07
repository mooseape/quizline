type Props = {
  remainingMs: number
  totalMs: number
}

export function MatchTimer({ remainingMs, totalMs }: Props) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs))
  const urgent = ratio <= 0.5 && remainingMs > 0

  return (
    <div className={`match-timer${urgent ? ' is-urgent' : ''}`}>
      <p className="timer-count" aria-live="polite">
        {seconds}
        <span>s</span>
      </p>
      <div
        className="timer-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalMs / 1000}
        aria-valuenow={seconds}
        aria-label={`${seconds} seconds left`}
      >
        <span style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="timer-hint">+pts for speed</p>
    </div>
  )
}
