import { useEffect, useMemo, useState } from 'react'
import { getBot } from '../data/bots'
import { categories, getCategory } from '../data/questions'
import { QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION } from '../lib/game'
import {
  getBestScore,
  getLastCategory,
  getLastOpponent,
  getPlayStreak,
  hasSeenRules,
  markRulesSeen,
} from '../lib/storage'
import type { CategoryId, Opponent } from '../types'
import { parseInvite } from '../lib/invite'
import { Avatar } from './Avatar'
import { RulesOverlay } from './RulesOverlay'
import { ThemeToggle } from './ThemeToggle'
import { TopicIcon } from './TopicIcon'

const SCORE_GOAL = 2500

const topics: { id: CategoryId; label: string }[] = [
  { id: 'mix', label: 'Daily Mix' },
  ...categories.map((category) => ({ id: category.id, label: category.name })),
]

type Props = {
  onPlay: (categoryId: CategoryId) => void
  onChallengeFriend: (categoryId: CategoryId) => void
  onJoinFriend: (code: string, categoryId: CategoryId) => void
  onChangeOpponent: (categoryId: CategoryId) => void
}

function formatScore(value: number) {
  return value.toLocaleString('en-US')
}

function levelFor(score: number) {
  return Math.max(1, Math.floor(score / 400) + 1)
}

function heroLine(categoryId: CategoryId, best: number, opponent: Opponent) {
  const name = getCategory(categoryId)?.name ?? 'Daily Mix'
  if (best > 0) return `Beat your ${name} best · ${formatScore(best)}`
  if (opponent.kind === 'bot') {
    const bot = getBot(opponent.botId)
    return bot ? `${bot.name} is waiting` : 'Your opponent is waiting'
  }
  if (opponent.kind === 'local') return 'Friend is on this device'
  if (opponent.kind === 'online') return 'Send a link — no accounts'
  return `First match in ${name}`
}

function opponentView(opponent: Opponent) {
  if (opponent.kind === 'bot') {
    const bot = getBot(opponent.botId)
    if (bot) {
      return {
        name: bot.name,
        tag: `${bot.difficulty} bot`,
        rank: bot.rank,
        points: bot.points,
        bestTopic: bot.bestTopic,
        hue: bot.hue,
        waiting: `${bot.name} is waiting`,
      }
    }
  }
  if (opponent.kind === 'online') {
    return {
      name: opponent.friendName || 'Friend',
      tag: 'Live 1v1',
      rank: 'Guest',
      points: 0,
      bestTopic: 'Any topic',
      hue: '#0ea5e9',
      waiting: 'Share a link to start',
    }
  }
  if (opponent.kind === 'local') {
    return {
      name: 'Friend',
      tag: 'Same device',
      rank: 'Guest',
      points: 0,
      bestTopic: 'Any topic',
      hue: '#0ea5e9',
      waiting: 'Seat them on the bottom half',
    }
  }
  return {
    name: 'Practice',
    tag: 'Solo',
    rank: 'Coach',
    points: 0,
    bestTopic: 'Warm-up',
    hue: '#64748b',
    waiting: 'No opponent this round',
  }
}

export function Home({ onPlay, onChallengeFriend, onJoinFriend, onChangeOpponent }: Props) {
  const [categoryId, setCategoryId] = useState<CategoryId>(getLastCategory)
  const opponent = getLastOpponent()
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [showRules, setShowRules] = useState(false)
  const streak = getPlayStreak()
  const bests = useMemo(
    () => Object.fromEntries(topics.map((topic) => [topic.id, getBestScore(topic.id)])),
    [],
  )

  useEffect(() => {
    if (!hasSeenRules()) setShowRules(true)
  }, [])

  const category = getCategory(categoryId)
  const best = bests[categoryId] ?? 0
  const face = opponentView(opponent)

  function closeRules() {
    markRulesSeen()
    setShowRules(false)
  }

  return (
    <main className="home">
      <header className="topbar">
        <div className="topbar-brand">
          <p className="logo">Quizline</p>
          <p className="home-meta">
            {QUESTIONS_PER_MATCH} questions · {SECONDS_PER_QUESTION} seconds
          </p>
        </div>
        <div className="topbar-tools">
          <p className="streak-chip" title="Matches finished">
            Streak {streak}
          </p>
          <Avatar name="You" hue="#ff2d6a" size="sm" />
          <button type="button" className="help-btn" aria-label="How to play" onClick={() => setShowRules(true)}>
            ?
          </button>
          <ThemeToggle compact />
        </div>
      </header>

      <section className="hero-row">
        <article className="hero-card">
          <p className="eyebrow">Selected match</p>
          <h1>{category?.name ?? 'Daily Mix'}</h1>
          <div className="hero-chips">
            <span className="diff-chip">{face.tag}</span>
            {best > 0 ? <span className="diff-chip ghost-chip">Lv {levelFor(best)}</span> : <span className="diff-chip ghost-chip">NEW</span>}
          </div>
          <p className="hero-copy">{heroLine(categoryId, best, opponent)}</p>
          <div className="hero-actions">
            <button type="button" className="play-cta" onClick={() => onPlay(categoryId)}>
              Play now
            </button>
            <button type="button" className="challenge-btn" onClick={() => onChallengeFriend(categoryId)}>
              Challenge a friend
            </button>
          </div>
          <form
            className="join-row"
            onSubmit={(event) => {
              event.preventDefault()
              const invite = parseInvite(joinCode)
              if (!invite) {
                setJoinError('Use the 6-character code from their link.')
                return
              }
              setJoinError('')
              onJoinFriend(invite.code, invite.categoryId)
            }}
          >
            <input
              className="lobby-input"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="Have a code?"
              autoComplete="off"
              spellCheck={false}
              aria-label="Friend room code"
            />
            <button type="submit" className="ghost">
              Join
            </button>
          </form>
          {joinError ? <p className="lobby-error">{joinError}</p> : null}
        </article>

        <article className="opponent-card">
          <p className="eyebrow">Opponent</p>
          <div className="opponent-face">
            <Avatar name={face.name} hue={face.hue} size="lg" />
            <div>
              <h2>{face.name}</h2>
              <p>{face.rank}</p>
            </div>
          </div>
          <dl className="opponent-stats">
            {face.points > 0 ? (
              <>
                <div>
                  <dt>Points</dt>
                  <dd>{formatScore(face.points)}</dd>
                </div>
                <div>
                  <dt>Best topic</dt>
                  <dd>{face.bestTopic}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Status</dt>
                <dd>{face.waiting}</dd>
              </div>
            )}
          </dl>
          <p className="waiting-line">{face.waiting}</p>
          <button type="button" className="text-link" onClick={() => onChangeOpponent(categoryId)}>
            Change opponent
          </button>
        </article>
      </section>

      <section className="topics">
        <h2>Topics</h2>
        <ul className="topic-grid">
          {topics.map((topic) => {
            const score = bests[topic.id] ?? 0
            const played = score > 0
            const featured = topic.id === 'mix'
            return (
              <li key={topic.id} className={featured ? 'span-feature' : undefined}>
                <button
                  type="button"
                  data-id={topic.id}
                  className={`cat-tile${topic.id === categoryId ? ' is-on' : ''}${featured ? ' is-featured' : ''}`}
                  onClick={() => setCategoryId(topic.id)}
                >
                  {featured ? <span className="today-chip">Today</span> : null}
                  <TopicIcon id={topic.id} />
                  <strong>{topic.label}</strong>
                  <span className="tile-level">{played ? `Lv ${levelFor(score)}` : 'NEW'}</span>
                  {played ? <span className="tile-score">{formatScore(score)}</span> : null}
                  {played ? (
                    <span className="tile-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (score / SCORE_GOAL) * 100)}%` }} />
                    </span>
                  ) : null}
                  <span className="tile-play">Play</span>
                </button>
              </li>
            )
          })}
          <li>
            <button type="button" className="cat-tile more-tile" data-id="more" disabled>
              <TopicIcon id="more" />
              <strong>More topics</strong>
              <span className="tile-level">Soon</span>
            </button>
          </li>
        </ul>
      </section>

      {showRules ? <RulesOverlay onClose={closeRules} /> : null}
    </main>
  )
}
