import { bots } from '../data/bots'
import { getCategory } from '../data/questions'
import type { CategoryId, Opponent } from '../types'

type Props = {
  categoryId: CategoryId
  onBack: () => void
  onStart: (opponent: Opponent) => void
}

export function OpponentSelect({ categoryId, onBack, onStart }: Props) {
  const category = getCategory(categoryId)

  return (
    <main className="panel">
      <p className="eyebrow">{category?.name ?? 'Category'}</p>
      <h1>Pick an opponent</h1>
      <p className="lede">Same split-screen for a bot or a friend on this device.</p>
      <ul className="categories">
        {bots.map((bot) => (
          <li key={bot.id}>
            <button
              type="button"
              className="category"
              onClick={() => onStart({ kind: 'bot', botId: bot.id })}
            >
              <span>
                <strong>
                  {bot.name} · {bot.difficulty}
                </strong>
                <em>{bot.blurb}</em>
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="category" onClick={() => onStart({ kind: 'local' })}>
            <span>
              <strong>Friend · Local</strong>
              <em>Two people, one screen — you on top, them below.</em>
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="category" onClick={() => onStart({ kind: 'solo' })}>
            <span>
              <strong>Practice</strong>
              <em>Solo round, no split-screen.</em>
            </span>
          </button>
        </li>
      </ul>
      <div className="actions">
        <button type="button" className="ghost" onClick={onBack}>
          Home
        </button>
      </div>
    </main>
  )
}
