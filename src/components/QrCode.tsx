import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  value: string
  size?: number
}

export function QrCode({ value, size = 120 }: Props) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#1a0b16', light: '#ffffff' } }).then(
      (url) => {
        if (!cancelled) setSrc(url)
      },
    )
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) return <span className="duel-qr" aria-hidden="true" />
  return <img className="duel-qr" alt="" width={size} height={size} src={src} />
}
