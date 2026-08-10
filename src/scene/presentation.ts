import type { PlanningIntent } from './planning/placement'
import type { Beat } from './playback/beats'

export const PRESENTATION_MODES = [
  'planning',
  'unit-focus',
  'facility-focus',
  'flow',
  'milestone',
  'event',
  'choice',
  'arrival',
  'ending',
] as const

export type PresentationMode = (typeof PRESENTATION_MODES)[number]

export interface PresentationInput {
  state: { phase: string }
  beat: Beat | undefined
  planningIntent: PlanningIntent
}

export interface PresentationFrame {
  mode: PresentationMode
  changed: boolean
}

export function derivePresentationMode(input: PresentationInput): PresentationMode {
  if (input.beat?.kind === 'milestone') return 'milestone'
  if (input.beat?.kind === 'death') return 'event'
  if (input.beat?.kind === 'event') return 'event'
  if (input.beat?.kind === 'arrival') return 'arrival'
  if (input.beat?.kind === 'flow') return 'flow'
  if (input.state.phase === 'ended') return 'ending'
  if (input.state.phase === 'choice') return 'choice'
  if (input.planningIntent.kind === 'place-unit') return 'unit-focus'
  if (
    input.planningIntent.kind === 'inspect-facility' ||
    input.planningIntent.kind === 'choose-unit-for-facility'
  ) {
    return 'facility-focus'
  }
  return 'planning'
}

export class PresentationDirector {
  private current: PresentationMode = 'planning'

  get mode(): PresentationMode {
    return this.current
  }

  resolve(input: PresentationInput): PresentationFrame {
    const next = derivePresentationMode(input)
    const changed = next !== this.current
    this.current = next
    return { mode: next, changed }
  }
}
