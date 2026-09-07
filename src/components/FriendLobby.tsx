import { useEffect, useRef, useState } from 'react'
import { getCategory } from '../data/questions'
import { getHandle, saveHandle } from '../lib/handle'
import { playUrl } from '../lib/invite'
import { announceHello, closeDuelRoom, openDuelRoom, peerCount } from '../lib/onlineDuel'
import type { CategoryId } from '../types'

type Props = {
  categoryId: CategoryId
  code: string
  role: 'host' | 'guest'
  onCancel: () => void
  onReady: (friendName: string) => void
}

export function FriendLobby({ categoryId, code, role, onCancel, onReady }: Props) {
  const category = getCategory(categoryId)
  const [name, setName] = useState(getHandle)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(role === 'host' ? 'Share the link. Waiting for a friend…' : 'Joining your friend…')
  const [error, setError] = useState('')
  const link = playUrl(code)
  const onReadyRef = useRef(onReady)
  const startedRef = useRef(false)
  onReadyRef.current = onReady

  useEffect(() => {
    saveHandle(name)
  }, [name])

  useEffect(() => {
    const session = openDuelRoom(code)

    function tryStart() {
      if (startedRef.current || peerCount() < 1) return
      startedRef.current = true
      onReadyRef.current(session.friendName || 'Friend')
    }

    session.room.onPeerJoin = () => {
      announceHello()
      setStatus('Friend found. Starting the duel…')
      window.setTimeout(tryStart, 400)
    }
    session.room.onPeerLeave = () => {
      if (!startedRef.current) setStatus('Friend disconnected. Waiting again…')
    }

    const stop = session.subscribe((msg) => {
      if (msg.t === 'hello') {
        announceHello()
        setStatus(`${msg.name} is in. Starting the duel…`)
        window.setTimeout(tryStart, 300)
      }
    })

    announceHello()
    if (peerCount() > 0) {
      setStatus('Friend found. Starting the duel…')
      window.setTimeout(tryStart, 400)
    }

    const timeout = window.setTimeout(() => {
      if (!startedRef.current) setError('Still searching. Ask them to open the same link, or try a new code.')
    }, 25000)

    return () => {
      stop()
      window.clearTimeout(timeout)
      session.room.onPeerJoin = null
      session.room.onPeerLeave = null
      if (!startedRef.current) closeDuelRoom()
    }
  }, [code])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Copy failed — select the link and copy it yourself.')
    }
  }

  function leave() {
    closeDuelRoom()
    onCancel()
  }

  return (
    <main className="panel lobby">
      <p className="eyebrow">{category?.name ?? 'Match'} · Live 1v1</p>
      <h1>{role === 'host' ? 'Invite a friend' : 'Joining the duel'}</h1>
      <p className="lede">No accounts. One link, two phones, same 10 questions.</p>

      <label className="lobby-label" htmlFor="handle">
        Your name
      </label>
      <input
        id="handle"
        className="lobby-input"
        value={name}
        maxLength={16}
        placeholder="You"
        onChange={(event) => setName(event.target.value)}
      />

      <p className="lobby-code" aria-label="Room code">
        {code}
      </p>
      <p className="lobby-link">{link}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => void copyLink()}>
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        <button type="button" className="ghost" onClick={leave}>
          Cancel
        </button>
      </div>
      <p className="waiting-line">{status}</p>
      {error ? <p className="lobby-error">{error}</p> : null}
    </main>
  )
}
