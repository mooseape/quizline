import { useEffect, useState, type FormEvent } from 'react'
import { AVATAR_PACK } from '../lib/avatars'
import { compressPhoto } from '../lib/account'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAccount } from '../lib/AccountContext'
import { Avatar } from './Avatar'

type Props = {
  onClose: () => void
}

export function AccountSheet({ onClose }: Props) {
  const account = useAccount()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tagDraft, setTagDraft] = useState(account.username)

  useEffect(() => {
    setTagDraft(account.username)
  }, [account.username])

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const dataUrl = await compressPhoto(file)
      account.setPhotoUrl(dataUrl)
    } catch {
      setError('Could not use that photo. Try a JPG or PNG.')
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signup') {
        const result = await account.signUp(email, password)
        setMessage(
          result.needsEmail
            ? 'Check your email to confirm, then sign in.'
            : 'Account saved. You’re signed in.',
        )
      } else {
        await account.signIn(email, password)
        setMessage('Signed in.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <div className="overlay-card account-card">
        <p className="eyebrow">Profile</p>
        <h2 id="account-title">{account.signedIn ? 'Your account' : 'Your look'}</h2>
        <div className="account-you">
          <Avatar name={account.name || 'You'} avatar={account.avatarId} src={account.photoUrl} size="lg" />
          <label className="lobby-label" htmlFor="account-name">
            Display name
            <input
              id="account-name"
              className="lobby-input"
              value={account.name}
              maxLength={16}
              placeholder="You"
              onChange={(event) => account.setName(event.target.value)}
            />
          </label>
        </div>
        {account.signedIn ? (
          <>
            <label className="lobby-label" htmlFor="account-tag">
              Quizline tag
              <input
                id="account-tag"
                className="lobby-input"
                value={tagDraft}
                maxLength={16}
                placeholder="your_tag"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={() => {
                  if (tagDraft === account.username) return
                  void account.setUsername(tagDraft).catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : 'Could not save tag.')
                    setTagDraft(account.username)
                  })
                }}
              />
            </label>
            <p className="waiting-line">Friends add you with this tag.</p>
          </>
        ) : null}

        <p className="lobby-label">Picture</p>
        <ul className="avatar-grid" aria-label="Choose a picture">
          {AVATAR_PACK.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`avatar-pick${account.avatarId === item.id && !account.photoUrl ? ' is-on' : ''}`}
                aria-label={item.label}
                onClick={() => {
                  account.setPhotoUrl(null)
                  account.setAvatarId(item.id)
                }}
              >
                <Avatar name={item.label} avatar={item.id} size="sm" />
              </button>
            </li>
          ))}
        </ul>

        <label className="photo-upload">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              void onPhoto(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          Upload a photo
        </label>
        {account.photoUrl ? (
          <button type="button" className="text-link" onClick={() => account.setPhotoUrl(null)}>
            Use a character instead
          </button>
        ) : null}

        {account.signedIn ? (
          <>
            <p className="account-email">{account.email}</p>
            <div className="account-actions">
              <button type="button" className="ghost" onClick={() => void account.signOut()}>
                Sign out
              </button>
              <button type="button" className="primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="account-split">
              {isSupabaseConfigured()
                ? 'Optional account — keep this name and picture on other devices.'
                : 'Accounts need Supabase keys. Your picture still saves on this device.'}
            </p>
            {isSupabaseConfigured() ? (
              <form className="account-form" onSubmit={(event) => void submitAuth(event)}>
                <div className="account-tabs">
                  <button
                    type="button"
                    className={`mode-btn${mode === 'signin' ? ' is-on' : ''}`}
                    onClick={() => setMode('signin')}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`mode-btn${mode === 'signup' ? ' is-on' : ''}`}
                    onClick={() => setMode('signup')}
                  >
                    Create account
                  </button>
                </div>
                <label className="lobby-label" htmlFor="account-email">
                  Email
                  <input
                    id="account-email"
                    className="lobby-input"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="lobby-label" htmlFor="account-pass">
                  Password
                  <input
                    id="account-pass"
                    className="lobby-input"
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <div className="account-actions">
                  <button type="button" className="ghost" onClick={onClose}>
                    Close
                  </button>
                  <button type="submit" className="primary" disabled={busy}>
                    {busy ? 'Saving…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="primary" onClick={onClose}>
                Done
              </button>
            )}
          </>
        )}
        {message ? <p className="waiting-line">{message}</p> : null}
        {error ? <p className="lobby-error">{error}</p> : null}
      </div>
    </div>
  )
}
