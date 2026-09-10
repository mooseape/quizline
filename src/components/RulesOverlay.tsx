type Props = {
  onClose: () => void
}

export function RulesOverlay({ onClose }: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="overlay-card">
        <h2 id="rules-title">How to play</h2>
        <ul>
          <li>10 questions. Pick a pace: Blitz 5s, Rapid 10s, or Normal 15s.</li>
          <li>Play now uses your last category, or today’s mix.</li>
          <li>Challenge a friend is live 1v1. Party with friends is a separate lobby for a group — those scores do not count toward 1v1 records.</li>
          <li>Faster correct answers score more. Harder questions pay more. Streaks add a bonus.</li>
        </ul>
        <button type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
