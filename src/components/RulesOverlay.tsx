type Props = {
  onClose: () => void
}

export function RulesOverlay({ onClose }: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="overlay-card">
        <h2 id="rules-title">How to play</h2>
        <ul>
          <li>10 questions. Pick a pace: Bullet 3s, Blitz 5s, or Rapid 10s.</li>
          <li>Play now uses your last category, or today’s mix. Play vs random matches you with another signed-in player.</li>
          <li>Challenge a friend is live 1v1. Party with friends is a group lobby — those scores do not count toward random ranks.</li>
          <li>Faster correct answers score more. Harder questions pay more. Streaks add a bonus. Ranks use wins, then points, from random matches only.</li>
        </ul>
        <button type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
