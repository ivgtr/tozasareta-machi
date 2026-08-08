import type { GameState } from '../game/types'
import type { Beat } from './playback/beats'
import type { FacilityId } from './town/layout'

export const PRESENTATION_MODES = [
  'planning',
  'unit-focus',
  'facility-focus',
  'flow',
  'event',
  'choice',
  'arrival',
  'ending',
] as const

export type PresentationMode = (typeof PRESENTATION_MODES)[number]

export interface PresentationInput {
  state: Pick<GameState, 'phase'>
  beat: Beat | undefined
  selectedUnitId: string | null
  selectedFacility: FacilityId | null
}

export interface PresentationFrame {
  mode: PresentationMode
  changed: boolean
}

export function derivePresentationMode(input: PresentationInput): PresentationMode {
  if (input.beat?.kind === 'event' || input.beat?.kind === 'death') return 'event'
  if (input.beat?.kind === 'arrival') return 'arrival'
  if (input.beat?.kind === 'flow') return 'flow'
  if (input.state.phase === 'choice') return 'choice'
  if (input.state.phase === 'ended') return 'ending'
  if (input.selectedUnitId) return 'unit-focus'
  if (input.selectedFacility) return 'facility-focus'
  return 'planning'
}

export class PresentationDirector {
  private currentMode: PresentationMode = 'planning'

  resolve(input: PresentationInput): PresentationFrame {
    const mode = derivePresentationMode(input)
    const changed = mode !== this.currentMode
    this.currentMode = mode
    return { mode, changed }
  }

  get mode(): PresentationMode {
    return this.currentMode
  }
}
