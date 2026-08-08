import type { Effect, GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { UI_TIMING, buildBeats, type Beat, type PlaybackContext } from './beats'
import { projectPlaybackState } from './project-state'

export interface Playback {
  base: GameState
  beats: Beat[]
  index: number
  confirmed: boolean
  reduced: boolean
}

export class PlaybackController {
  private playback: Playback | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  onChange: () => void = () => undefined

  get current(): Playback | null {
    return this.playback
  }

  get beat(): Beat | undefined {
    return this.playback ? (this.playback.beats[this.playback.index] ?? undefined) : undefined
  }

  get projectedState(): GameState | null {
    const playback = this.playback
    if (!playback) return null
    const effects = playback.beats.slice(0, playback.index + 1).flatMap((beat) => beat.effects)
    return projectPlaybackState(playback.base, effects)
  }

  get waiting(): boolean {
    const beat = this.beat
    return (
      this.playback !== null &&
      beat !== undefined &&
      beat.kind !== 'flow' &&
      !this.playback.confirmed
    )
  }

  start(previous: GameState, effects: Effect[], context?: PlaybackContext): void {
    this.clearTimer()
    const beats = buildBeats(effects, context)
    if (beats.length === 0) {
      this.playback = null
      this.onChange()
      return
    }
    this.playback = {
      base: previous,
      beats,
      index: 0,
      confirmed: false,
      reduced: reducedMotion(),
    }
    this.schedule()
    this.onChange()
  }

  skipFlow(): void {
    const playback = this.playback
    if (!playback || this.beat?.kind !== 'flow') return
    this.clearTimer()
    let next = playback.index + 1
    while (next < playback.beats.length && playback.beats[next]?.kind === 'flow') next++
    this.playback =
      next >= playback.beats.length ? null : { ...playback, index: next, confirmed: false }
    this.schedule()
    this.onChange()
  }

  cancel(): void {
    this.clearTimer()
    this.playback = null
    this.onChange()
  }

  confirm(): void {
    if (!this.playback || this.beat?.kind === 'flow') return
    this.playback = { ...this.playback, confirmed: true }
    this.schedule()
    this.onChange()
  }

  destroy(): void {
    this.clearTimer()
    this.playback = null
  }

  private schedule(): void {
    const playback = this.playback
    if (!playback) return
    const beat = playback.beats[playback.index]
    if (!beat) return
    const spotlight = beat.kind !== 'flow'
    if (spotlight && !playback.confirmed) return
    const delay = spotlight
      ? UI_TIMING.afterConfirmMs
      : playback.reduced
        ? UI_TIMING.reducedFlowMs
        : UI_TIMING.flowMs
    this.clearTimer()
    this.timer = setTimeout(() => this.advance(), delay)
  }

  private advance(): void {
    const playback = this.playback
    if (!playback) return
    const next = playback.index + 1
    this.playback =
      next >= playback.beats.length ? null : { ...playback, index: next, confirmed: false }
    this.schedule()
    this.onChange()
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
