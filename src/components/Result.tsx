import { QUESTIONS_PER_MATCH } from '../lib/game'
import { getCategory } from '../data/questions'
import { getBot } from '../data/bots'
import type { CategoryId, Opponent } from '../types'
import { Avatar } from './Avatar'

const TOPIC_HUE: Record<CategoryId, string> = {
  mix: '#ff2d6a',
  general: '#e39b00',
  science: '#0ea5a0',
  history: '#e86a00',
  pop: '#6d3dff',
}

type Props = {
  categoryId: CategoryId
  opponent: Opponent
  you: { score: number; correct: number }
  them?: { name: string; score: number; correct: number }
  previousBest: number
  onReplay: () => void
  onHome: () => void
}

function formatPts(value: number) {
  return `${value.toLocaleString('en-US')} pts`
}

function opponentMeta(opponent: Opponent) {
  if (opponent.kind === 'solo') return { name: 'Practice', hue: '#64748b' }
  if (opponent.kind === 'local' || opponent.kind === 'online') {
    return { name: opponent.kind === 'online' ? opponent.friendName || 'Friend' : 'Friend', hue: '#0ea5e9' }
  }
  const bot = getBot(opponent.botId)
  return { name: bot?.name ?? 'Bot', hue: bot?.hue ?? '#ec4899' }
}

function CorrectDots({ correct, total }: { correct: number; total: number }) {
  return (
    <span className="dot-row" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < correct ? 'is-on' : ''} />
      ))}
    </span>
  )
}

function flavorLine(args: {
  versus: boolean
  youWon: boolean
  draw: boolean
  isNewBest: boolean
  topic: string
  you: { score: number; correct: number }
  them?: { name: string; score: number; correct: number }
}) {
  if (args.isNewBest) return `New ${args.topic} best`
  if (!args.versus || !args.them) return `${args.you.correct}/${QUESTIONS_PER_MATCH} locked in`
  const gap = args.you.correct - args.them.correct
  if (Math.abs(gap) <= 1) return `Close one — ${args.them.name} had ${args.them.correct}/${QUESTIONS_PER_MATCH}`
  if (args.draw) return 'Same score — rematch?'
  if (args.youWon && gap > 0) return `${gap} more correct than ${args.them.name}`
  if (args.youWon) return `Won by ${(args.you.score - args.them.score).toLocaleString('en-US')} pts`
  return `${args.them.name} by ${(args.them.score - args.you.score).toLocaleString('en-US')} pts`
}

export function Result({
  categoryId,
  opponent,
  you,
  them,
  previousBest,
  onReplay,
  onHome,
}: Props) {
  const category = getCategory(categoryId)
  const topic = category?.name ?? 'Match'
  const hue = TOPIC_HUE[categoryId]
  const rival = opponentMeta(opponent)
  const versus = Boolean(them && opponent.kind !== 'solo')
  const draw = versus && them != null && you.score === them.score
  const youWon = versus && them != null ? you.score > them.score : you.score > previousBest
  const isNewBest = you.score > previousBest && you.score > 0

  let headline = 'Round over'
  if (versus && draw) headline = 'Draw'
  else if (versus && youWon) headline = 'You win'
  else if (versus && them) headline = `${them.name} wins`
  else if (isNewBest) headline = 'New best'

  const flavor = flavorLine({
    versus,
    youWon,
    draw,
    isNewBest,
    topic,
    you,
    them,
  })

  const maxPts = Math.max(you.score, them?.score ?? 0, 1)
  const maxHits = QUESTIONS_PER_MATCH

  return (
    <main className="results" style={{ ['--topic' as string]: hue }} data-topic={categoryId}>
      <header className="results-banner">
        <p className="topic-chip">
          {topic} · vs {rival.name}
        </p>
        <h1>{headline}</h1>
      </header>

      <div className="results-shell">
        <section className="faceoff-card" aria-label="Head to head">
          <div className={`face${youWon && !draw ? ' is-winner' : ''}${versus && !youWon && !draw ? ' is-muted' : ''}`}>
            {youWon && !draw ? (
              <span className="win-mark" aria-hidden="true">
                Win
              </span>
            ) : null}
            <Avatar name="You" hue="#ff2d6a" size="lg" />
            <strong>You</strong>
            <p className="face-pts">{formatPts(you.score)}</p>
            <p className="face-hits">
              {you.correct}/{QUESTIONS_PER_MATCH}
            </p>
            <div className="stat-bar" aria-hidden="true">
              <span style={{ width: `${(you.score / maxPts) * 100}%` }} />
            </div>
            <div className="stat-bar slim" aria-hidden="true">
              <span style={{ width: `${(you.correct / maxHits) * 100}%` }} />
            </div>
          </div>

          {versus && them ? (
            <>
              <p className="vs-mark">vs</p>
              <div
                className={`face${!youWon && !draw ? ' is-winner' : ''}${youWon && !draw ? ' is-muted' : ''}`}
              >
                {!youWon && !draw ? (
                  <span className="win-mark" aria-hidden="true">
                    Win
                  </span>
                ) : null}
                <Avatar name={them.name} hue={rival.hue} size="lg" />
                <strong>{them.name}</strong>
                <p className="face-pts">{formatPts(them.score)}</p>
                <p className="face-hits">
                  {them.correct}/{QUESTIONS_PER_MATCH}
                </p>
                <div className="stat-bar" aria-hidden="true">
                  <span style={{ width: `${(them.score / maxPts) * 100}%` }} />
                </div>
                <div className="stat-bar slim" aria-hidden="true">
                  <span style={{ width: `${(them.correct / maxHits) * 100}%` }} />
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="results-main">
          <p className="results-score">{you.score.toLocaleString('en-US')}</p>
          <p className="results-correct">
            {you.correct}/{QUESTIONS_PER_MATCH} correct
          </p>
          <CorrectDots correct={you.correct} total={QUESTIONS_PER_MATCH} />
          <p className="results-flavor">{flavor}</p>
          <div className="results-actions">
            <button type="button" className="play-cta" onClick={onReplay}>
              Play again
            </button>
            <button type="button" className="challenge-btn" onClick={onHome}>
              Home
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
