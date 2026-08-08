import { getSettings } from '../../store'
import { AUDIO_CUE_NOTES, type AudioCue, type AudioNote } from './audio-cues'

export type AudioMood = 'silent' | 'planning' | 'crisis'

type AudioContextClass = new () => AudioContext

function audioContextClass(): AudioContextClass | null {
  if (typeof window === 'undefined') return null
  const candidate = window as typeof window & { webkitAudioContext?: AudioContextClass }
  return window.AudioContext ?? candidate.webkitAudioContext ?? null
}

export class AudioDirector {
  private context: AudioContext | null = null
  private sfxGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private bgmNodes: AudioScheduledSourceNode[] = []
  private mood: AudioMood = 'silent'
  private activeMood: AudioMood = 'silent'

  async unlock(): Promise<void> {
    if (!getSettings().sound) return
    const context = this.ensureContext()
    if (!context) return
    if (context.state === 'suspended') await context.resume().catch(() => undefined)
    this.applyMood()
  }

  play(cue: AudioCue): void {
    if (!getSettings().sound) return
    const context = this.ensureContext()
    const output = this.sfxGain
    if (!context || !output) return
    if (context.state === 'suspended') void this.unlock().then(() => this.schedule(cue))
    else this.schedule(cue)
  }

  setMood(mood: AudioMood): void {
    this.mood = mood
    if (!getSettings().sound) {
      this.stopBgm()
      return
    }
    this.applyMood()
  }

  syncSettings(): void {
    if (!getSettings().sound) {
      this.stopBgm()
      return
    }
    void this.unlock()
  }

  destroy(): void {
    this.stopBgm()
    const context = this.context
    this.context = null
    this.sfxGain = null
    this.bgmGain = null
    if (context && context.state !== 'closed') void context.close()
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    const Context = audioContextClass()
    if (!Context) return null
    const context = new Context()
    const sfxGain = context.createGain()
    const bgmGain = context.createGain()
    sfxGain.gain.value = 0.8
    bgmGain.gain.value = 0.7
    sfxGain.connect(context.destination)
    bgmGain.connect(context.destination)
    this.context = context
    this.sfxGain = sfxGain
    this.bgmGain = bgmGain
    return context
  }

  private schedule(cue: AudioCue): void {
    const context = this.context
    const output = this.sfxGain
    if (!context || !output || context.state !== 'running') return
    const start = context.currentTime
    for (const tone of AUDIO_CUE_NOTES[cue]) this.scheduleNote(context, output, start, tone)
  }

  private scheduleNote(
    context: AudioContext,
    output: AudioNode,
    start: number,
    note: AudioNote,
  ): void {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const begins = start + note.delayMs / 1000
    const ends = begins + note.durationMs / 1000
    oscillator.type = note.wave
    oscillator.frequency.setValueAtTime(note.frequency, begins)
    envelope.gain.setValueAtTime(0.0001, begins)
    envelope.gain.exponentialRampToValueAtTime(note.gain, begins + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, ends)
    oscillator.connect(envelope)
    envelope.connect(output)
    oscillator.start(begins)
    oscillator.stop(ends + 0.01)
  }

  private applyMood(): void {
    const context = this.context
    const output = this.bgmGain
    if (!context || !output || context.state !== 'running' || this.activeMood === this.mood) return
    this.stopBgm()
    if (this.mood === 'silent') return
    const base = this.mood === 'crisis' ? 73.42 : 82.41
    const frequencies =
      this.mood === 'crisis' ? [base, base * 1.05946, base * 2] : [base, base * 1.5]
    const level = this.mood === 'crisis' ? 0.018 : 0.012
    for (const [index, frequency] of frequencies.entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const lfo = context.createOscillator()
      const lfoGain = context.createGain()
      oscillator.type = index === 0 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = level / (index + 1)
      lfo.frequency.value = 0.07 + index * 0.025
      lfoGain.gain.value = level * 0.45
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)
      oscillator.connect(gain)
      gain.connect(output)
      oscillator.start()
      lfo.start()
      this.bgmNodes.push(oscillator, lfo)
    }
    this.activeMood = this.mood
  }

  private stopBgm(): void {
    for (const node of this.bgmNodes) node.stop()
    this.bgmNodes = []
    this.activeMood = 'silent'
  }
}

const directors = new WeakMap<object, AudioDirector>()

export function audioDirectorFor(owner: object): AudioDirector {
  const current = directors.get(owner)
  if (current) return current
  const director = new AudioDirector()
  directors.set(owner, director)
  return director
}

export function destroyAudioDirector(owner: object): void {
  directors.get(owner)?.destroy()
  directors.delete(owner)
}
