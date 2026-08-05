import type { Effect, GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { UI_TIMING, buildBeats, type Beat } from './beats'

export interface Playback {
  prev: GameState
  beats: Beat[]
  index: number
  confirmed: boolean
}

export class PlaybackController {
  private pb: Playback | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  onChange: () => void = () => undefined

  get current(): Playback | null {
    return this.pb
  }

  get beat(): Beat | undefined {
    return this.pb ? (this.pb.beats[this.pb.index] ?? undefined) : undefined
  }

  get waiting(): boolean {
    const beat = this.beat
    return this.pb !== null && beat !== undefined && beat.kind !== 'flow' && !this.pb.confirmed
  }

  start(prev: GameState, effects: Effect[]): void {
    this.clearTimer()
    if (effects.length === 0 || reducedMotion()) {
      this.pb = null
      this.onChange()
      return
    }
    this.pb = { prev, beats: buildBeats(effects), index: 0, confirmed: false }
    this.schedule()
    this.onChange()
  }

  skip(): void {
    this.clearTimer()
    this.pb = null
    this.onChange()
  }

  confirm(): void {
    if (!this.pb) return
    this.pb = { ...this.pb, confirmed: true }
    this.schedule()
    this.onChange()
  }

  destroy(): void {
    this.clearTimer()
    this.pb = null
  }

  private schedule(): void {
    const pb = this.pb
    if (!pb) return
    const beat = pb.beats[pb.index]
    if (!beat) return
    const spotlight = beat.kind !== 'flow'
    if (spotlight && !pb.confirmed) return
    const delay = spotlight ? UI_TIMING.afterConfirmMs : UI_TIMING.effectMs
    this.clearTimer()
    this.timer = setTimeout(() => {
      const cur = this.pb
      if (!cur) return
      const next = cur.index + 1
      this.pb = next >= cur.beats.length ? null : { ...cur, index: next, confirmed: false }
      if (this.pb) this.schedule()
      this.onChange()
    }, delay)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
