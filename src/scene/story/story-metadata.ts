import { findEvent } from '../../game/events'
import type { EventDef, GameState, Unit } from '../../game/types'

export type StoryLayout = 'dialogue' | 'report' | 'incident'
export type PortraitSide = 'left' | 'right'

export interface StoryPresentationSpec {
  speaker?: string
  layout: StoryLayout
  portraitSide?: PortraitSide
}

export interface StoryPresentationModel {
  event: EventDef
  spec: StoryPresentationSpec
  speaker: Unit | null
}

const STORY_PRESENTATION: Record<string, StoryPresentationSpec> = {
  elderly_illness: { speaker: 'medic', layout: 'report', portraitSide: 'left' },
  generator_failure: { speaker: 'engineer', layout: 'report', portraitSide: 'left' },
  hidden_stockpile: { speaker: 'farmer', layout: 'dialogue', portraitSide: 'left' },
  foraging: { speaker: 'farmer', layout: 'dialogue', portraitSide: 'left' },
  power_restored: { speaker: 'engineer', layout: 'dialogue', portraitSide: 'left' },
  medical_donation: { speaker: 'medic', layout: 'report', portraitSide: 'left' },
  volunteers: { speaker: 'mayor', layout: 'dialogue', portraitSide: 'left' },
  ration_protest: { speaker: 'mayor', layout: 'report', portraitSide: 'right' },
  rescue_contact: { speaker: 'mayor', layout: 'report', portraitSide: 'left' },
  infection: { speaker: 'medic', layout: 'report', portraitSide: 'left' },
  protest: { speaker: 'mayor', layout: 'report', portraitSide: 'right' },
  water_shortage: { speaker: 'farmer', layout: 'report', portraitSide: 'left' },
  theft: { speaker: 'mayor', layout: 'report', portraitSide: 'right' },
  radio_repair: { speaker: 'engineer', layout: 'dialogue', portraitSide: 'left' },
  childbirth: { speaker: 'medic', layout: 'dialogue', portraitSide: 'left' },
  elder_death: { speaker: 'mayor', layout: 'dialogue', portraitSide: 'right' },
  gratitude: { speaker: 'mayor', layout: 'dialogue', portraitSide: 'left' },
  trade_offer: { speaker: 'mayor', layout: 'dialogue', portraitSide: 'left' },
  power_crisis: { speaker: 'engineer', layout: 'report', portraitSide: 'left' },
  stockpile_crisis: { speaker: 'farmer', layout: 'report', portraitSide: 'left' },
  expedition: { speaker: 'mayor', layout: 'dialogue', portraitSide: 'left' },
}

function defaultSpec(event: EventDef): StoryPresentationSpec {
  return { layout: event.tone === 'threat' ? 'incident' : 'report' }
}

export function storyPresentationSpec(event: EventDef): StoryPresentationSpec {
  return STORY_PRESENTATION[event.id] ?? defaultSpec(event)
}

export function deriveStoryPresentation(
  eventId: string,
  state: Pick<GameState, 'units'>,
): StoryPresentationModel | null {
  const event = findEvent(eventId)
  if (!event) return null
  const spec = storyPresentationSpec(event)
  return {
    event,
    spec,
    speaker: spec.speaker
      ? (state.units.find((candidate) => candidate.id === spec.speaker) ?? null)
      : null,
  }
}
