const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
}

const BANNED = [
  'anal',
  'anus',
  'arsehole',
  'asshole',
  'bastard',
  'bitch',
  'blowjob',
  'bollocks',
  'boobs',
  'bukkake',
  'clit',
  'cock',
  'coon',
  'crap',
  'cum',
  'cunt',
  'dick',
  'dildo',
  'dyke',
  'fag',
  'faggot',
  'fck',
  'fcuk',
  'fuck',
  'fucker',
  'fucking',
  'fuk',
  'gaysex',
  'hentai',
  'homo',
  'horny',
  'jackoff',
  'jerkoff',
  'kike',
  'milf',
  'nazi',
  'negro',
  'nigga',
  'nigger',
  'nude',
  'orgasm',
  'pedo',
  'penis',
  'piss',
  'porn',
  'prick',
  'pussy',
  'queer',
  'rape',
  'rapist',
  'retard',
  'rimjob',
  'semen',
  'shit',
  'slut',
  'spunk',
  'sucker',
  'tits',
  'tranny',
  'twat',
  'vagina',
  'wank',
  'whore',
]

const SHORT = new Set(['ass', 'cum', 'fag', 'sex', 'tit'])

function fold(raw: string) {
  return raw
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compact(raw: string) {
  return fold(raw).replace(/ /g, '')
}

export function isAbusiveText(raw: string) {
  const text = fold(raw)
  if (!text) return false
  const squeezed = compact(raw)
  const words = text.split(' ')
  for (const word of BANNED) {
    if (words.includes(word) || squeezed === word) return true
    if (word.length >= 5 && squeezed.includes(word)) return true
  }
  for (const word of SHORT) {
    if (words.includes(word) || squeezed === word) return true
  }
  return false
}

export function assertCleanDisplayName(raw: string) {
  const name = raw.trim()
  if (!name) return
  if (isAbusiveText(name)) {
    throw new Error('Pick a different name. That one isn’t allowed.')
  }
}

export function assertCleanUsername(raw: string) {
  if (!raw) return
  if (isAbusiveText(raw)) {
    throw new Error('That tag isn’t allowed. Choose another.')
  }
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read that photo.'))
    image.src = dataUrl
  })
}

function scoreOf(
  preds: { className: string; probability: number }[],
  name: string,
) {
  return preds.find((row) => row.className === name)?.probability ?? 0
}

export async function assertSafePhoto(dataUrl: string) {
  const image = await loadImage(dataUrl)
  try {
    const nsfwjs = await import('nsfwjs')
    const model = await nsfwjs.load()
    const preds = await model.classify(image, 5)
    const adult = scoreOf(preds, 'Porn') + scoreOf(preds, 'Hentai')
    const sexy = scoreOf(preds, 'Sexy')
    if (adult > 0.45 || sexy > 0.72) {
      throw new Error('That photo isn’t allowed. Use a character picture instead.')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('isn’t allowed')) throw error
    throw new Error('Couldn’t verify that photo. Use a character picture instead.')
  }
}
