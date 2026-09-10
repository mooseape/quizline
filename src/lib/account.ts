import type { User } from '@supabase/supabase-js'
import { getHandle, handleOrYou, saveHandle } from './handle'
import { parseAvatarId, type AvatarId } from './avatars'
import { parseFrameId, type FrameId } from './frames'
import { getSupabase } from './supabase'
import { safeMediaUrl } from './safeUrl'
import { assertCleanDisplayName, assertCleanUsername } from './moderation'
import { getCurrentUserId } from './sessionUser'

const AVATAR_KEY = 'quizline-avatar'
const PHOTO_KEY = 'quizline-photo'
const FRAME_KEY = 'quizline-frame'
const USERNAME_KEY = 'quizline-username'
const COUNTRY_KEY = 'quizline-country'
const listeners = new Set<() => void>()

export type AccountSnapshot = {
  name: string
  username: string
  avatarId: AvatarId
  photoUrl: string | null
  frameId: FrameId | null
  country: string
}

export function getAvatarId(): AvatarId {
  return parseAvatarId(localStorage.getItem(AVATAR_KEY))
}

export function getPhotoUrl(): string | null {
  const raw = localStorage.getItem(PHOTO_KEY)
  if (!raw) return null
  if (raw.startsWith('data:image') || raw.startsWith('https://')) return raw
  return null
}

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
}

export function getUsername() {
  return normalizeUsername(localStorage.getItem(USERNAME_KEY) ?? '')
}

export function getFrameId(): FrameId | null {
  return parseFrameId(localStorage.getItem(FRAME_KEY))
}

export function saveFrameId(id: FrameId | null) {
  if (getFrameId() === id) return
  if (id) localStorage.setItem(FRAME_KEY, id)
  else localStorage.removeItem(FRAME_KEY)
  notify()
}

export function getCountry() {
  const raw = (localStorage.getItem(COUNTRY_KEY) ?? '').toUpperCase()
  if (raw === 'IL') {
    localStorage.removeItem(COUNTRY_KEY)
    return ''
  }
  return /^[A-Z]{2}$/.test(raw) ? raw : ''
}

export function saveCountry(code: string) {
  const next = code.trim().toUpperCase()
  if (next === getCountry()) return
  if (/^[A-Z]{2}$/.test(next)) localStorage.setItem(COUNTRY_KEY, next)
  else localStorage.removeItem(COUNTRY_KEY)
  notify()
}

export function getAccountSnapshot(): AccountSnapshot {
  return {
    name: getHandle(),
    username: getUsername(),
    avatarId: getAvatarId(),
    photoUrl: getPhotoUrl(),
    frameId: getFrameId(),
    country: getCountry(),
  }
}

export function subscribeAccount(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function saveAvatarId(id: AvatarId) {
  if (getAvatarId() === id) return
  localStorage.setItem(AVATAR_KEY, id)
  notify()
}

export function savePhotoUrl(url: string | null) {
  if (getPhotoUrl() === url) return
  if (url) localStorage.setItem(PHOTO_KEY, url)
  else localStorage.removeItem(PHOTO_KEY)
  notify()
}

export function saveDisplayName(name: string) {
  assertCleanDisplayName(name)
  const next = name.trim().slice(0, 16)
  if (next === getHandle()) return
  saveHandle(name)
  notify()
}

export function saveUsername(raw: string) {
  const next = normalizeUsername(raw)
  if (next === getUsername()) return next
  if (next) localStorage.setItem(USERNAME_KEY, next)
  else localStorage.removeItem(USERNAME_KEY)
  notify()
  return next
}

function suggestUsername(name: string) {
  const slug = normalizeUsername(name)
  if (slug.length >= 3) return slug
  return `player${slug}`.slice(0, 16).padEnd(3, '0')
}

async function claimUsername(preferred: string) {
  const supabase = getSupabase()
  if (!supabase) return preferred
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  const base = suggestUsername(preferred || getHandle() || 'player')
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 12)}${Math.floor(10 + Math.random() * 90)}`
    const { data } = await supabase.rpc('lookup_profile_by_username', { tag: candidate })
    const row = Array.isArray(data) ? data[0] : data
    if (!row || row.id === userId) return candidate
  }
  return `${base.slice(0, 8)}${Date.now().toString(36).slice(-4)}`
}

export function shareablePhoto(url: string | null) {
  return safeMediaUrl(url?.startsWith('https://') ? url : null)
}

export function presenceProfile(extra: Record<string, unknown> = {}) {
  return {
    name: handleOrYou(),
    avatar: getAvatarId(),
    photo: shareablePhoto(getPhotoUrl()),
    frame: getFrameId() ?? undefined,
    uid: getCurrentUserId() || undefined,
    ...extra,
  }
}

function metaOf(user: User | null) {
  const data = user?.user_metadata ?? {}
  return {
    name: typeof data.display_name === 'string' ? data.display_name : '',
    username: typeof data.username === 'string' ? normalizeUsername(data.username) : '',
    avatarId: parseAvatarId(data.avatar_id),
    photoUrl: typeof data.photo_url === 'string' ? data.photo_url : '',
    frameId: parseFrameId(data.frame_id),
  }
}

export function applyUserProfile(user: User | null) {
  if (!user || user.is_anonymous) return
  const meta = metaOf(user)
  if (meta.name.trim()) saveHandle(meta.name)
  if (meta.username) saveUsername(meta.username)
  saveAvatarId(meta.avatarId)
  saveFrameId(meta.frameId)
  if (meta.photoUrl.startsWith('https://') || meta.photoUrl.startsWith('data:image')) {
    savePhotoUrl(meta.photoUrl)
  }
}

export async function pushAccountToCloud() {
  const supabase = getSupabase()
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user || user.is_anonymous) return

  const display_name = (getHandle() || 'You').slice(0, 16)
  assertCleanDisplayName(display_name)
  const avatar_id = getAvatarId()
  const frame_id = getFrameId()
  const username = await claimUsername(getUsername() || display_name)
  assertCleanUsername(username)
  saveUsername(username)
  let photo_url = shareablePhoto(getPhotoUrl()) ?? null
  const localPhoto = getPhotoUrl()

  if (localPhoto?.startsWith('data:image')) {
    const uploaded = await uploadAvatarDataUrl(user.id, localPhoto)
    if (uploaded) {
      photo_url = uploaded
      savePhotoUrl(uploaded)
    }
  }

  const country = getCountry() || null

  await supabase.auth.updateUser({
    data: { display_name, avatar_id, photo_url, frame_id, username, country },
  })

  await supabase.from('profiles').upsert({
    id: user.id,
    display_name,
    username,
    avatar_id,
    photo_url,
    frame_id,
    country,
    updated_at: new Date().toISOString(),
  })
}

export async function hydrateCloudProfile(user: User | null) {
  applyUserProfile(user)
  if (!user || user.is_anonymous) return
  const supabase = getSupabase()
  if (!supabase) return
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_id, photo_url, frame_id, country')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.username) saveUsername(data.username)
  if (data?.display_name) saveDisplayName(data.display_name)
  if (typeof data?.avatar_id === 'string') saveAvatarId(parseAvatarId(data.avatar_id))
  if (typeof data?.photo_url === 'string') savePhotoUrl(safeMediaUrl(data.photo_url) ?? null)
  if (data && 'frame_id' in data) saveFrameId(parseFrameId(data.frame_id))
  if (typeof data?.country === 'string' && /^[A-Z]{2}$/i.test(data.country) && data.country.toUpperCase() !== 'IL') {
    saveCountry(data.country.toUpperCase())
  }
  if (!data?.username) await pushAccountToCloud()
}

export async function saveUsernameAndSync(raw: string) {
  const next = normalizeUsername(raw)
  if (next.length < 3) throw new Error('Tags need 3–16 letters, numbers, or underscores.')
  assertCleanUsername(next)
  const supabase = getSupabase()
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (user && !user.is_anonymous) {
      const { data: found } = await supabase.rpc('lookup_profile_by_username', { tag: next })
      const taken = Array.isArray(found) ? found[0] : found
      if (taken && taken.id !== user.id) throw new Error('That tag is already taken.')
    }
  }
  saveUsername(next)
  await pushAccountToCloud()
}

let pushTimer = 0

export function pushAccountSoon() {
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void pushAccountToCloud()
  }, 700)
}

async function uploadAvatarDataUrl(userId: string, dataUrl: string) {
  const supabase = getSupabase()
  if (!supabase) return null
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) return null
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that photo.')
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

export function isEmailAccount(user: User | null) {
  return Boolean(user && !user.is_anonymous && user.email)
}

export function authRedirectUrl() {
  const fromEnv = import.meta.env.VITE_SITE_URL
  const origin = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : window.location.origin
  return `${origin.replace(/\/$/, '')}/`
}

export function consumeAuthRedirectError() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  if (!hash.includes('error=')) return null
  const params = new URLSearchParams(hash)
  const code = params.get('error_code')
  const desc = params.get('error_description')?.replace(/\+/g, ' ')
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  if (code === 'otp_expired') {
    return 'That confirmation link expired or already got used. Open Quizline on this site, then sign in — or create the account again for a new email.'
  }
  return desc || 'Could not confirm that email link.'
}

function throwAuthError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Could not sign in.'
  const lower = message.toLowerCase()
  if (lower.includes('rate limit')) {
    throw new Error(
      'Too many confirmation emails just now. Wait a few minutes and check your inbox before trying again.',
    )
  }
  if (lower.includes('already registered') || lower.includes('user already')) {
    throw new Error('That email already has an account. Sign in instead.')
  }
  throw error instanceof Error ? error : new Error(message)
}

export async function signUpAccount(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Add Supabase keys to enable accounts.')
  const trimmed = email.trim()
  const redirectTo = authRedirectUrl()
  const meta = {
    display_name: getHandle() || 'You',
    avatar_id: getAvatarId(),
      photo_url: shareablePhoto(getPhotoUrl()) ?? null,
      frame_id: getFrameId(),
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const anon = sessionData.session?.user
  if (anon?.is_anonymous) {
    const pendingEmail = anon.email?.toLowerCase()
    const samePending = pendingEmail === trimmed.toLowerCase() && !anon.email_confirmed_at
    if (samePending) return { needsEmail: true }
    const { error } = await supabase.auth.updateUser(
      { email: trimmed, password, data: meta },
      { emailRedirectTo: redirectTo },
    )
    if (error) throwAuthError(error)
    return { needsEmail: true }
  }
  const { data, error } = await supabase.auth.signUp({
    email: trimmed,
    password,
    options: { data: meta, emailRedirectTo: redirectTo },
  })
  if (error) throwAuthError(error)
  return { needsEmail: !data.session }
}

export async function signInAccount(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Add Supabase keys to enable accounts.')
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throwAuthError(error)
}

export async function signOutAccount() {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.auth.signOut()
}
