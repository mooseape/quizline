const HANDLE_KEY = 'quizline-handle'

export function getHandle(): string {
  const raw = localStorage.getItem(HANDLE_KEY)?.trim() ?? ''
  return raw.slice(0, 16)
}

export function saveHandle(name: string) {
  const next = name.trim().slice(0, 16)
  if (next) localStorage.setItem(HANDLE_KEY, next)
  else localStorage.removeItem(HANDLE_KEY)
}

export function handleOrYou(): string {
  return getHandle() || 'You'
}
