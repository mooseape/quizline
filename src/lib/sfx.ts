type Tone = 'click' | 'correct' | 'wrong'

let ctx: AudioContext | null = null
let heartbeatOn = false
let heartbeatHandle = 0
let nextBeat = 0
let clicksBound = false

function audio() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function envGain(ac: AudioContext, start: number, peak: number, attack: number, release: number) {
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + release)
  return gain
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  peak: number,
) {
  const osc = ac.createOscillator()
  const gain = envGain(ac, start, peak, 0.008, duration)
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration + 0.04)
}

function noiseBurst(ac: AudioContext, start: number, duration: number, peak: number) {
  const sampleRate = ac.sampleRate
  const length = Math.max(1, Math.floor(sampleRate * duration))
  const buffer = ac.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 1800
  const gain = envGain(ac, start, peak, 0.004, duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

function playClick(ac: AudioContext) {
  const t = ac.currentTime
  noiseBurst(ac, t, 0.04, 0.09)
  tone(ac, 2100, t, 0.045, 'triangle', 0.05)
}

function playCorrect(ac: AudioContext) {
  const t = ac.currentTime
  tone(ac, 523.25, t, 0.12, 'triangle', 0.11)
  tone(ac, 659.25, t + 0.07, 0.13, 'triangle', 0.12)
  tone(ac, 783.99, t + 0.14, 0.22, 'sine', 0.13)
}

function playWrong(ac: AudioContext) {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = envGain(ac, t, 0.14, 0.01, 0.22)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, t)
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.2)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.26)
}

function kick(ac: AudioContext, start: number) {
  const osc = ac.createOscillator()
  const gain = envGain(ac, start, 0.22, 0.006, 0.18)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, start)
  osc.frequency.exponentialRampToValueAtTime(48, start + 0.16)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(start)
  osc.stop(start + 0.22)
}

function scheduleBeats() {
  const ac = audio()
  if (!ac || !heartbeatOn) return
  if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + 0.02
  while (nextBeat < ac.currentTime + 1.3) {
    kick(ac, nextBeat)
    kick(ac, nextBeat + 0.17)
    nextBeat += 1.05
  }
  heartbeatHandle = window.setTimeout(scheduleBeats, 200)
}

export function playSfx(kind: Tone) {
  const ac = audio()
  if (!ac) return
  if (kind === 'click') playClick(ac)
  if (kind === 'correct') playCorrect(ac)
  if (kind === 'wrong') playWrong(ac)
}

export function startHeartbeat() {
  const ac = audio()
  if (!ac || heartbeatOn) return
  heartbeatOn = true
  nextBeat = ac.currentTime + 0.01
  scheduleBeats()
}

export function stopHeartbeat() {
  heartbeatOn = false
  window.clearTimeout(heartbeatHandle)
  heartbeatHandle = 0
}

function clickTarget(event: Event) {
  const node = event.target
  if (!(node instanceof Element)) return null
  return node.closest('button, [role="button"], input[type="submit"], input[type="button"], summary')
}

export function installUiSounds() {
  if (clicksBound || typeof window === 'undefined') return
  clicksBound = true
  const unlock = () => {
    audio()
  }
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener(
    'click',
    (event) => {
      const target = clickTarget(event)
      if (!target) return
      if (target.closest('.choice, .answer')) return
      if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
      playSfx('click')
    },
    true,
  )
}
