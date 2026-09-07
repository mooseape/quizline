type Props = {
  onClose: () => void
}

export function RulesOverlay({ onClose }: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="overlay-card">
        <h2 id="rules-title">How to play</h2>
        <ul>
          <li>10 questions, 15 seconds each.</li>
          <li>Play now uses your last category, or today’s mix.</li>
          <li>Challenge a friend sends a live 1v1 link — no accounts. Same-device play is still in opponent select.</li>
          <li>Faster correct answers score more. Streaks add a bonus.</li>
        </ul>
        <button type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
