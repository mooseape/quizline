import { useEffect, useState } from 'react'
import { FLAG_NAME_CODES } from '../data/flagNations'

type Props = {
  code: string
}

function scrubSvg(raw: string) {
  const svgStart = raw.indexOf('<svg')
  const cut = svgStart >= 0 ? raw.slice(svgStart) : raw
  return cut
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<text[\s\S]*?<\/text>/gi, '')
    .replace(/<tspan[\s\S]*?<\/tspan>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
}

export function FlagArt({ code }: Props) {
  const named = FLAG_NAME_CODES.has(code.toUpperCase())
  const lower = code.toLowerCase()
  const png = `https://flagcdn.com/w640/${lower}.png`
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    if (!named) {
      setSvg(null)
      return undefined
    }
    let gone = false
    void fetch(`https://flagcdn.com/${lower}.svg`)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((raw) => {
        if (!gone) setSvg(scrubSvg(raw))
      })
      .catch(() => {
        if (!gone) setSvg(null)
      })
    return () => {
      gone = true
    }
  }, [lower, named])

  return (
    <div className={`flag-art${named ? ' is-named' : ''}`} aria-hidden="true">
      {svg ? (
        <span className="flag-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <img src={png} alt="" />
      )}
      {named ? <span className="flag-scrub" /> : null}
    </div>
  )
}
