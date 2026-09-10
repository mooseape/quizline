let currentUserId = ''

export function setCurrentUserId(id: string | null) {
  currentUserId = id ?? ''
}

export function getCurrentUserId() {
  return currentUserId
}
