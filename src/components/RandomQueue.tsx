import { useEffect, useRef, useState } from 'react'
import { getCategory } from '../data/questions'
import { PACE_LABEL, secondsForPace } from '../lib/game'
import { findRankedMatch } from '../lib/rankedQueue'
import type { CategoryId, PaceMode } from '../types'

type Props = {
  categoryId: CategoryId
  pace: PaceMode
  onCancel: () => void
  onMatched: (match: {
    code: string
    role: 'host' | 'guest'
    name: string
    avatar?: string
    photo?: string
    frame?: string
    opponentId: string
    categoryId: CategoryId
    pace: PaceMode
  }) => void
}

export function RandomQueue({ categoryId, pace, onCancel, onMatched }: Props) {
  const [error, setError] = useState('')
  const onMatchedRef = useRef(onMatched)
  onMatchedRef.current = onMatched

  useEffect(() => {
    const abort = new AbortController()
    setError('')
    void findRankedMatch(categoryId, pace, undefined, abort.signal)
      .then((match) => {
        onMatchedRef.current({
          code: match.code,
          role: match.role,
          name: match.peer.name,
          avatar: match.peer.avatar,
          photo: match.peer.photo,
          frame: match.peer.frame,
          opponentId: match.peer.userId,
          categoryId: match.categoryId,
          pace: match.pace,
        })
      })
      .catch((reason: unknown) => {
        if (abort.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Could not find a match.')
      })
    return () => abort.abort()
  }, [categoryId, pace])

  const category = getCategory(categoryId)

  return (
    <main className="duel-invite">
      <article className="duel-invite-card">
        <p className="eyebrow">Random opponent</p>
        <h1>Finding a player</h1>
        <p className="hero-copy">
          {category?.name ?? 'Daily Mix'} · {PACE_LABEL[pace]} · {secondsForPace(pace)}s
        </p>
        <p className={`duel-status${error ? '' : ' is-wait'}`}>
          {error || 'Waiting for another signed-in player. Same pace is best; any topic can match.'}
        </p>
        <button type="button" className="ghost duel-copy" onClick={onCancel}>
          Cancel
        </button>
      </article>
    </main>
  )
}
