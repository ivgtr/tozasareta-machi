import type { Effect } from '../../game/types'
import type { Beat } from './beats'

export type BeatImportance = 'minor' | 'normal' | 'major'

export interface BeatPresentationSpec {
  importance: BeatImportance
  durationMs: number
}

export const PLAYBACK_TIMING = {
  minorMs: 620,
  normalMs: 1500,
  majorMs: 2700,
  reducedMs: 620,
  afterConfirmMs: 250,
} as const

function hasLargeChange(effects: readonly Effect[]): boolean {
  return effects.some(
    (effect) =>
      effect.delta >= 24 ||
      effect.delta <= -24 ||
      (effect.target.startsWith('flag:') && effect.delta !== 0),
  )
}

export function deriveBeatImportance(beat: Beat): BeatImportance {
  if (beat.kind === 'death' || beat.kind === 'arrival') return 'major'
  if (beat.kind === 'event') return hasLargeChange(beat.effects) ? 'major' : 'normal'
  if (beat.source.startsWith('act_') || hasLargeChange(beat.effects)) return 'major'
  if (beat.source === 'settlement') return 'minor'
  return 'normal'
}

export function deriveBeatPresentation(beat: Beat, reduced: boolean): BeatPresentationSpec {
  const importance = deriveBeatImportance(beat)
  const durationMs = reduced
    ? PLAYBACK_TIMING.reducedMs
    : importance === 'minor'
      ? PLAYBACK_TIMING.minorMs
      : importance === 'major'
        ? PLAYBACK_TIMING.majorMs
        : PLAYBACK_TIMING.normalMs
  return { importance, durationMs }
}
