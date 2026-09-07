type Props = {
  ratio: number
  secondsLeft: number
}

export function TimerRail({ ratio, secondsLeft }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio))
  const reachedHalf = clamped <= 0.5
  const elapsed = (1 - clamped) * 100

  return (
    <div
      className={`timer-rail${reachedHalf && clamped > 0 ? ' is-half' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={`${secondsLeft} seconds left`}
    >
      <div className="timer-track">
        {!reachedHalf ? (
          <span className="timer-slash timer-slash-mid" aria-hidden="true">
            /
          </span>
        ) : null}
        <span
          className="timer-slash timer-slash-run"
          style={{ left: `${elapsed}%` }}
          aria-hidden="true"
        >
          /
        </span>
      </div>
    </div>
  )
}
