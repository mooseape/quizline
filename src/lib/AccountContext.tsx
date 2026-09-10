import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  consumeAuthRedirectError,
  getAccountSnapshot,
  hydrateCloudProfile,
  isEmailAccount,
  pushAccountSoon,
  pushAccountToCloud,
  saveAvatarId,
  saveCountry,
  saveDisplayName,
  saveFrameId,
  savePhotoUrl,
  saveUsernameAndSync,
  signInAccount,
  signOutAccount,
  signUpAccount,
  subscribeAccount,
  type AccountSnapshot,
} from './account'
import { setCurrentUserId } from './sessionUser'
import type { AvatarId } from './avatars'
import type { FrameId } from './frames'
import { getSupabase, isSupabaseConfigured } from './supabase'

type AccountContextValue = AccountSnapshot & {
  email: string | null
  userId: string | null
  signedIn: boolean
  ready: boolean
  notice: string | null
  clearNotice: () => void
  setName: (name: string) => void
  setCountry: (code: string) => void
  setAvatarId: (id: AvatarId) => void
  setFrameId: (id: FrameId | null) => void
  setPhotoUrl: (url: string | null) => void
  setUsername: (username: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsEmail: boolean }>
  signOut: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState(getAccountSnapshot)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [ready, setReady] = useState(!isSupabaseConfigured())
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => subscribeAccount(() => setSnap(getAccountSnapshot())), [])

  useEffect(() => {
    const fromLink = consumeAuthRedirectError()
    if (fromLink) setNotice(fromLink)
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return undefined
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setSignedIn(isEmailAccount(user))
      setEmail(isEmailAccount(user) ? user!.email ?? null : null)
      const id = isEmailAccount(user) ? user!.id : null
      setUserId(id)
      setCurrentUserId(id)
      void hydrateCloudProfile(user).then(() => setSnap(getAccountSnapshot()))
      setReady(true)
    })
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null
      setSignedIn(isEmailAccount(user))
      setEmail(isEmailAccount(user) ? user!.email ?? null : null)
      const id = isEmailAccount(user) ? user!.id : null
      setUserId(id)
      setCurrentUserId(id)
      void hydrateCloudProfile(user).then(() => {
        setSnap(getAccountSnapshot())
        setReady(true)
      })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AccountContextValue>(
    () => ({
      ...snap,
      email,
      userId,
      signedIn,
      ready,
      notice,
      clearNotice: () => setNotice(null),
      setName: (name) => {
        saveDisplayName(name)
        pushAccountSoon()
      },
      setCountry: (code) => {
        saveCountry(code)
        pushAccountSoon()
      },
      setAvatarId: (id) => {
        saveAvatarId(id)
        pushAccountSoon()
      },
      setFrameId: (id) => {
        saveFrameId(id)
        pushAccountSoon()
      },
      setPhotoUrl: (url) => {
        savePhotoUrl(url)
        void pushAccountToCloud()
      },
      setUsername: (username) => saveUsernameAndSync(username),
      signIn: async (nextEmail, password) => {
        await signInAccount(nextEmail, password)
      },
      signUp: (nextEmail, password) => signUpAccount(nextEmail, password),
      signOut: signOutAccount,
    }),
    [snap, email, userId, signedIn, ready, notice],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useAccount needs AccountProvider')
  return value
}

export function useOptionalAccount() {
  return useContext(AccountContext)
}
