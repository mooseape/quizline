type Props = {
  active: boolean
}

export function HalfGlow({ active }: Props) {
  if (!active) return null
  return <div className="half-glow" aria-hidden="true" />
}
