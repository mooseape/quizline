import { useEffect } from 'react'
import { startHeartbeat, stopHeartbeat } from '../lib/sfx'

type Props = {
  active: boolean
}

export function HalfGlow({ active }: Props) {
  useEffect(() => {
    if (!active) {
      stopHeartbeat()
      return undefined
    }
    startHeartbeat()
    return () => stopHeartbeat()
  }, [active])

  if (!active) return null
  return <div className="half-glow" aria-hidden="true" />
}
