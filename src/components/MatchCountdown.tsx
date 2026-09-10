type Props = {
  seconds: number
}

export function MatchCountdown({ seconds }: Props) {
  return (
    <div className="match-countdown" aria-live="assertive" aria-label={`Starting in ${seconds}`}>
      <p className="match-countdown-num">{seconds}</p>
    </div>
  )
}
