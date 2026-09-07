type Props = {
  name: string
  hue?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, hue = '#ff2d6a', size = 'md' }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={`avatar avatar-${size}`} style={{ background: hue }} aria-hidden="true">
      {initial}
    </span>
  )
}
