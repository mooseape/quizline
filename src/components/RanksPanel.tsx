import { useEffect, useState } from 'react'
import { COUNTRIES, countryName } from '../data/countries'
import { loadLeaderboard, type LeaderboardKind, type LeaderboardRow } from '../lib/leaderboard'
import { useAccount } from '../lib/AccountContext'
import { Avatar } from './Avatar'

type Props = {
  onNeedAccount: () => void
}

export function RanksPanel({ onNeedAccount }: Props) {
  const account = useAccount()
  const [kind, setKind] = useState<LeaderboardKind>('global')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!account.signedIn) return
    let alive = true
    setBusy(true)
    setError('')
    void loadLeaderboard(kind, account.country)
      .then((next) => {
        if (alive) setRows(next)
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not load ranks.')
      })
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [account.signedIn, account.country, kind])

  if (!account.signedIn) {
    return (
      <section className="friends-panel">
        <h1>Ranks</h1>
        <p className="friends-tagline">Sign in to see global, national, and friends boards from random matches.</p>
        <button type="button" className="primary" onClick={onNeedAccount}>
          Sign in
        </button>
      </section>
    )
  }

  return (
    <section className="friends-panel">
      <h1>Ranks</h1>
      <p className="friends-tagline">Wins against randoms, then points from those matches.</p>
      <div className="mode-row" role="tablist" aria-label="Leaderboard">
        {(['global', 'national', 'friends'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`mode-btn${kind === option ? ' is-on' : ''}`}
            onClick={() => setKind(option)}
          >
            {option === 'global' ? 'Global' : option === 'national' ? 'National' : 'Friends'}
          </button>
        ))}
      </div>
      {kind === 'national' && !account.country ? (
        <p className="lobby-error">
          Set your country in your account to see a national board.{' '}
          <button type="button" className="text-link" onClick={onNeedAccount}>
            Open account
          </button>
        </p>
      ) : null}
      {error ? <p className="lobby-error">{error}</p> : null}
      {busy ? <p className="waiting-line">Loading ranks…</p> : null}
      {!busy && !error && rows.length === 0 ? (
        <p className="waiting-line">No ranked random matches yet. Play vs random to climb the board.</p>
      ) : null}
      <ol className="friends-list ranks-list">
        {rows.map((row) => (
          <li key={row.userId} className={row.isYou ? 'is-you' : undefined}>
            <div className="friend-face">
              <span className="rank-place">{row.rank}</span>
              <Avatar name={row.name} avatar={row.avatarId} src={row.photoUrl} size="sm" />
              <div>
                <strong>
                  {row.name}
                  {row.isYou ? ' (you)' : ''}
                </strong>
                <span>
                  {row.username ? `@${row.username}` : 'Player'}
                  {kind === 'global' && row.country ? ` · ${countryName(row.country)}` : ''}
                </span>
              </div>
            </div>
            <div className="rank-stats">
              <strong>{row.wins} wins</strong>
              <span>{row.points.toLocaleString('en-US')} pts</span>
            </div>
          </li>
        ))}
      </ol>
      {kind === 'national' && account.country ? (
        <p className="waiting-line">{COUNTRIES.find((item) => item.code === account.country)?.name} board</p>
      ) : null}
    </section>
  )
}
