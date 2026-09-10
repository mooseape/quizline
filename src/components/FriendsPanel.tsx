import { useEffect, useState, type FormEvent } from 'react'
import {
  acceptFriendRequest,
  loadFriends,
  removeFriendship,
  sendFriendRequest,
  subscribeFriends,
  type FriendList,
  type FriendProfile,
} from '../lib/friends'
import { getSupabase } from '../lib/supabase'
import { useAccount } from '../lib/AccountContext'
import { Avatar } from './Avatar'

type Props = {
  onNeedAccount: () => void
  onChallenge: () => void
}

const EMPTY: FriendList = { friends: [], incoming: [], outgoing: [] }

export function FriendsPanel({ onNeedAccount, onChallenge }: Props) {
  const account = useAccount()
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [list, setList] = useState<FriendList>(EMPTY)

  async function refresh() {
    if (!account.signedIn) {
      setList(EMPTY)
      return
    }
    try {
      setList(await loadFriends())
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load friends.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [account.signedIn])

  useEffect(() => {
    if (!account.signedIn) return undefined
    const supabase = getSupabase()
    if (!supabase) return undefined
    let cancelled = false
    let stop: () => void = () => undefined
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id
      if (!userId || cancelled) return
      stop = subscribeFriends(userId, () => {
        void refresh()
      })
    })
    function onFocus() {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      stop()
      window.removeEventListener('focus', onFocus)
    }
  }, [account.signedIn])

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await sendFriendRequest(tag)
      setTag('')
      setMessage(result.accepted ? 'You’re friends now.' : 'Request sent.')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that friend.')
    } finally {
      setBusy(false)
    }
  }

  async function onAccept(id: string) {
    try {
      await acceptFriendRequest(id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not accept.')
    }
  }

  async function onRemove(id: string) {
    try {
      await removeFriendship(id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update friends.')
    }
  }

  if (!account.signedIn) {
    return (
      <section className="friends-panel">
        <p className="eyebrow">Friends</p>
        <h1>Play with people you know</h1>
        <p className="hero-copy">Create an account so friends can add you by your Quizline tag.</p>
        <button type="button" className="primary" onClick={onNeedAccount}>
          Sign in to add friends
        </button>
      </section>
    )
  }

  return (
    <section className="friends-panel">
      <p className="eyebrow">Friends</p>
      <h1>Your people</h1>
      <p className="friends-tagline">
        Your tag is <strong>@{account.username || '…'}</strong> — share it so they can add you.
      </p>

      <form className="friends-add" onSubmit={(event) => void onAdd(event)}>
        <label className="lobby-label" htmlFor="friend-tag">
          Add by tag
          <input
            id="friend-tag"
            className="lobby-input"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="@their-tag"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {message ? <p className="waiting-line">{message}</p> : null}
      {error ? <p className="lobby-error">{error}</p> : null}

      {list.incoming.length ? (
        <div className="friends-block">
          <h2>Requests</h2>
          <ul className="friends-list">
            {list.incoming.map((item) => (
              <li key={item.id}>
                <FriendRow profile={item.profile} />
                <div className="friends-row-actions">
                  <button type="button" className="primary" onClick={() => void onAccept(item.id)}>
                    Accept
                  </button>
                  <button type="button" className="ghost" onClick={() => void onRemove(item.id)}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="friends-block">
        <h2>Friends {list.friends.length ? <span>{list.friends.length}</span> : null}</h2>
        {list.friends.length === 0 ? (
          <p className="waiting-line">No friends yet. Add someone by their tag.</p>
        ) : (
          <ul className="friends-list">
            {list.friends.map((item) => (
              <li key={item.id}>
                <FriendRow profile={item.profile} />
                <div className="friends-row-actions">
                  <button type="button" className="primary" onClick={onChallenge}>
                    Duel
                  </button>
                  <button type="button" className="ghost" onClick={() => void onRemove(item.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {list.outgoing.length ? (
        <div className="friends-block">
          <h2>Sent</h2>
          <ul className="friends-list">
            {list.outgoing.map((item) => (
              <li key={item.id}>
                <FriendRow profile={item.profile} />
                <button type="button" className="ghost" onClick={() => void onRemove(item.id)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function FriendRow({ profile }: { profile: FriendProfile }) {
  return (
    <div className="friend-face">
      <Avatar name={profile.name} avatar={profile.avatarId} src={profile.photoUrl} frame={profile.frameId} size="sm" />
      <div>
        <strong>{profile.name}</strong>
        <span>@{profile.username || 'unknown'}</span>
      </div>
    </div>
  )
}
