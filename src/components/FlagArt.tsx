import { FLAG_NAME_CODES } from '../data/flagNations'

type Props = {
  code: string
}

export function FlagArt({ code }: Props) {
  const named = FLAG_NAME_CODES.has(code.toUpperCase())
  const png = `https://flagcdn.com/w640/${code.toLowerCase()}.png`

  return (
    <div className={`flag-art${named ? ' is-named' : ''}`} aria-hidden="true">
      <img src={png} alt="" />
      {named ? <span className="flag-scrub" /> : null}
    </div>
  )
}
